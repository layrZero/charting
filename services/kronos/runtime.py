"""Lazy adapter around the pinned, local-only Kronos checkout."""
from __future__ import annotations

import os
import copy
import hashlib
import json
import random
import sys
from collections import OrderedDict
from contextlib import contextmanager
from threading import RLock
from pathlib import Path

import numpy as np
import pandas as pd
import torch

ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCE = ROOT / '.deps' / 'Kronos'
MODEL_REVISION = '67b630e67f6a18c9e9be918d9b4337c960db1e9a'
MODEL_NAME = os.environ.get('KRONOS_MODEL', 'NeoQuasar/Kronos-small')
TOKENIZER_NAME = os.environ.get('KRONOS_TOKENIZER', 'NeoQuasar/Kronos-Tokenizer-base')
INFERENCE_CONFIG = {'pred_len': 10, 'T': 1.0, 'top_p': 0.9, 'sample_count': 1}
MAX_CACHE_ENTRIES = 32


def timestamp_series(values):
    """Convert Unix-second timestamps to the Series Kronos expects."""
    return pd.Series(pd.to_datetime(values, unit='s', utc=True), name='timestamp')


def _canonical_number(value):
    return round(float(value), 12)


def canonical_request(symbol, exchange, interval, bars, timestamps):
    return {
        'symbol': str(symbol),
        'exchange': str(exchange),
        'interval': str(interval),
        'bars': [
            {
                'time': int(bar['time']),
                'open': _canonical_number(bar['open']),
                'high': _canonical_number(bar['high']),
                'low': _canonical_number(bar['low']),
                'close': _canonical_number(bar['close']),
                'volume': _canonical_number(bar.get('volume', 0)),
            }
            for bar in bars
        ],
        'future_timestamps': [int(timestamp) for timestamp in timestamps],
        'model': MODEL_NAME,
        'tokenizer': TOKENIZER_NAME,
        'model_revision': MODEL_REVISION,
        'inference': INFERENCE_CONFIG,
    }


def forecast_fingerprint(symbol, exchange, interval, bars, timestamps):
    payload = json.dumps(
        canonical_request(symbol, exchange, interval, bars, timestamps),
        sort_keys=True,
        separators=(',', ':'),
    ).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def seed_for_fingerprint(fingerprint):
    return int.from_bytes(bytes.fromhex(fingerprint[:16]), 'big') & ((1 << 63) - 1)


@contextmanager
def isolated_seed(seed):
    python_state = random.getstate()
    numpy_state = np.random.get_state()
    cuda_devices = list(range(torch.cuda.device_count())) if torch.cuda.is_available() else []
    with torch.random.fork_rng(devices=cuda_devices):
        random.seed(seed)
        np.random.seed(seed % (2 ** 32))
        torch.manual_seed(seed)
        try:
            yield
        finally:
            random.setstate(python_state)
            np.random.set_state(numpy_state)


class KronosRuntime:
    def __init__(self):
        source = Path(os.environ.get('KRONOS_SOURCE_DIR', DEFAULT_SOURCE))
        if not (source / 'model').is_dir():
            raise RuntimeError('Kronos is not bootstrapped. Run npm run forecast:bootstrap first.')
        sys.path.insert(0, str(source))
        from model import Kronos, KronosPredictor, KronosTokenizer
        self._predictor = KronosPredictor(
            Kronos.from_pretrained(MODEL_NAME),
            KronosTokenizer.from_pretrained(TOKENIZER_NAME),
            max_context=512,
            device=os.environ.get('KRONOS_DEVICE', 'cpu'),
        )
        self._cache = OrderedDict()
        self._cache_lock = RLock()

    def forecast(self, bars, timestamps, *, symbol='', exchange='', interval=''):
        fingerprint = forecast_fingerprint(symbol, exchange, interval, bars, timestamps)
        with self._cache_lock:
            cached = self._cache.get(fingerprint)
            if cached is not None:
                self._cache.move_to_end(fingerprint)
                return copy.deepcopy(cached), True, fingerprint

        frame = pd.DataFrame(bars)
        x_timestamp = timestamp_series(frame.pop('time'))
        with isolated_seed(seed_for_fingerprint(fingerprint)):
            prediction = self._predictor.predict(
                df=frame[['open', 'high', 'low', 'close', 'volume']],
                x_timestamp=x_timestamp,
                y_timestamp=timestamp_series(timestamps),
                **INFERENCE_CONFIG,
            )
        rows = prediction.to_dict(orient='records')
        with self._cache_lock:
            self._cache[fingerprint] = copy.deepcopy(rows)
            self._cache.move_to_end(fingerprint)
            while len(self._cache) > MAX_CACHE_ENTRIES:
                self._cache.popitem(last=False)
        return rows, False, fingerprint
