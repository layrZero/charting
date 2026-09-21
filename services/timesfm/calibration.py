"""Small deterministic walk-forward TimesFM calibration worker."""
from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
import hashlib
import json
import os
from threading import RLock

from calibration_store import CalibrationStore
from runtime import MAX_CONTEXT, MODEL_ID, MODEL_REVISION, TimesFMRuntime, forecast_fingerprint

CALIBRATION_VERSION = int(os.environ.get('TIMESFM_CALIBRATION_VERSION', '1'))
ORIGINS = int(os.environ.get('TIMESFM_CALIBRATION_ORIGINS', '32'))
HORIZONS = (1, 2, 3, 5, 10)


def context_key(symbol, exchange, interval, bars, model_id=MODEL_ID, model_revision=MODEL_REVISION):
    history_fingerprint = forecast_fingerprint(symbol, exchange, interval, bars, [])
    payload = {'symbol': symbol, 'exchange': exchange, 'interval': interval, 'history': history_fingerprint, 'model': model_id, 'revision': model_revision, 'version': CALIBRATION_VERSION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class CalibrationManager:
    def __init__(self, store, runtime):
        self.store = store
        self.runtime = runtime
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='timesfm-calibration')
        self._lock = RLock()
        self._jobs = {}

    def start(self, *, symbol, exchange, interval, bars, timestamps):
        key = context_key(symbol, exchange, interval, bars)
        ready = self.store.get_ready(key, ttl_seconds=24 * 3600, minimum_new_bars=16, current_bar_count=len(bars))
        if ready:
            return {'status': 'ready', 'context_key': key, **ready}
        with self._lock:
            existing = self._jobs.get(key)
            if existing and not existing.done():
                return {'status': 'running', 'context_key': key, 'run_id': key[:16], 'total_origins': ORIGINS}
            run_id = key[:16]
            self.store.begin(run_id=run_id, context_key=key, symbol=symbol, exchange=exchange, interval=interval, history_fingerprint=key, model_id=MODEL_ID, model_revision=MODEL_REVISION, version=CALIBRATION_VERSION, origins=ORIGINS, history_bars=len(bars))
            self._jobs[key] = self.executor.submit(self._run, key, run_id, symbol, exchange, interval, list(bars), list(timestamps))
            return {'status': 'running', 'context_key': key, 'run_id': run_id, 'total_origins': ORIGINS}

    def _run(self, key, run_id, symbol, exchange, interval, bars, timestamps):
        context_length = min(MAX_CONTEXT, len(bars) - ORIGINS - max(HORIZONS))
        if context_length < 64:
            self.store.fail(run_id, 'insufficient history for 32 walk-forward origins')
            return
        max_origin = len(bars) - max(HORIZONS)
        origins = [max(context_length, max_origin - index * max(1, (max_origin - context_length) // ORIGINS)) for index in range(ORIGINS)]
        origins = sorted(set(origins))[-ORIGINS:]
        if len(origins) < ORIGINS:
            self.store.fail(run_id, 'insufficient history for 32 walk-forward origins')
            return
        errors = {horizon: {name: [] for name in ('P10', 'P25', 'P50', 'P75', 'P90')} for horizon in HORIZONS}
        origin_rows = []
        for origin in origins:
            context = bars[origin - context_length:origin]
            future = [int(bars[origin + index]['time']) for index in range(10)]
            result, _, _ = self.runtime.forecast(context, future, symbol=symbol, exchange=exchange, interval=interval)
            for horizon in HORIZONS:
                item = result['uncertainty']['horizon'][horizon - 1]
                actual = float(bars[origin + horizon - 1]['close'])
                quantiles = item['quantiles']
                for name in errors[horizon]:
                    errors[horizon][name].append(actual - float(quantiles[name]))
                origin_rows.append((int(item['timestamp']), horizon, quantiles, actual))
        offsets = {str(horizon): {name: sum(values) / len(values) for name, values in members.items()} for horizon, members in errors.items()}
        coverage = {horizon: {'P10': len(errors[horizon]['P10'])} for horizon in HORIZONS}
        self.store.complete(run_id, offsets, coverage, origin_rows)

    def status(self, key):
        return self.store.status(key)
