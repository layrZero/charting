"""Small deterministic walk-forward TimesFM calibration worker."""
from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
import hashlib
import json
import os
from threading import Event, RLock
import time

from calibration_store import CalibrationStore
from runtime import MAX_CONTEXT, MODEL_ID, MODEL_REVISION, TimesFMRuntime, forecast_fingerprint

CALIBRATION_VERSION = int(os.environ.get('TIMESFM_CALIBRATION_VERSION', '1'))
ORIGINS = int(os.environ.get('TIMESFM_CALIBRATION_ORIGINS', '32'))
BATCH_SIZE = max(1, int(os.environ.get('TIMESFM_CALIBRATION_BATCH_SIZE', '4')))
MAX_SECONDS = max(1, int(os.environ.get('TIMESFM_CALIBRATION_MAX_SECONDS', '600')))
HORIZONS = (1, 2, 3, 5, 10)


def context_key(symbol, exchange, interval, bars, model_id=MODEL_ID, model_revision=MODEL_REVISION):
    history_fingerprint = forecast_fingerprint(symbol, exchange, interval, bars, [])
    payload = {'symbol': symbol, 'exchange': exchange, 'interval': interval, 'history': history_fingerprint, 'model': model_id, 'revision': model_revision, 'version': CALIBRATION_VERSION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def stable_context_key(symbol, exchange, interval, model_id=MODEL_ID, model_revision=MODEL_REVISION):
    """Identify a calibration scope independently of the latest candle count."""
    payload = {'symbol': symbol, 'exchange': exchange, 'interval': interval, 'model': model_id, 'revision': model_revision, 'version': CALIBRATION_VERSION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class CalibrationManager:
    def __init__(self, store, runtime):
        self.store = store
        self.runtime = runtime
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='timesfm-calibration')
        self._lock = RLock()
        self._jobs = {}
        self._cancel_events = {}
        self._run_ids = {}

    def start(self, *, symbol, exchange, interval, bars, timestamps):
        key = context_key(symbol, exchange, interval, bars)
        scope = stable_context_key(symbol, exchange, interval)
        ready = self.store.get_reusable(stable_context_key=scope, symbol=symbol, exchange=exchange, interval=interval, model_id=MODEL_ID, model_revision=MODEL_REVISION, version=CALIBRATION_VERSION, ttl_seconds=24 * 3600, minimum_new_bars=16, current_bar_count=len(bars))
        if ready:
            return {'status': 'ready', 'context_key': key, 'stable_context_key': scope, **ready}
        with self._lock:
            existing = self._jobs.get(scope)
            if existing and not existing.done():
                return {'status': 'running', 'context_key': key, 'stable_context_key': scope, 'run_id': self._run_ids.get(scope, scope[:16]), 'total_origins': ORIGINS}
            run_id = key[:16]
            for old_key, event in list(self._cancel_events.items()):
                if old_key != scope:
                    event.set()
            self.store.begin(run_id=run_id, context_key=key, stable_context_key=scope, symbol=symbol, exchange=exchange, interval=interval, history_fingerprint=key, model_id=MODEL_ID, model_revision=MODEL_REVISION, version=CALIBRATION_VERSION, origins=ORIGINS, history_bars=len(bars))
            cancel_event = Event()
            self._cancel_events[scope] = cancel_event
            self._run_ids[scope] = run_id
            self._jobs[scope] = self.executor.submit(self._run, scope, run_id, symbol, exchange, interval, list(bars), list(timestamps), cancel_event)
            return {'status': 'running', 'context_key': key, 'stable_context_key': scope, 'run_id': run_id, 'total_origins': ORIGINS, 'history_bars': len(bars), 'batch_size': BATCH_SIZE, 'device': self.runtime.device_info.get('device_selected')}

    def _run(self, key, run_id, symbol, exchange, interval, bars, timestamps, cancel_event):
        started = time.monotonic()
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
        for start in range(0, len(origins), BATCH_SIZE):
            if cancel_event.is_set() or time.monotonic() - started > MAX_SECONDS:
                self.store.fail(run_id, 'calibration cancelled or exceeded the configured time limit')
                return
            batch = []
            for origin in origins[start:start + BATCH_SIZE]:
                context = bars[origin - context_length:origin]
                future = [int(bars[origin + index]['time']) for index in range(10)]
                batch.append({'bars': context, 'timestamps': future})
            try:
                results = self._forecast_batch_adaptive(batch, cancel_event, symbol, exchange, interval)
            except RuntimeError as error:
                if 'cancelled' in str(error).lower():
                    self.store.fail(run_id, 'calibration cancelled')
                    return
                self.store.fail(run_id, 'calibration inference failed')
                return
            for origin, result in zip(origins[start:start + BATCH_SIZE], results):
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

    def _forecast_batch_adaptive(self, batch, cancel_event, symbol, exchange, interval):
        current = list(batch)
        while current:
            if cancel_event.is_set():
                raise RuntimeError('calibration cancelled')
            try:
                return self.runtime.forecast_batch(current, cancel_check=lambda: cancel_event.is_set() and (_raise_cancel()))
            except RuntimeError as error:
                text = str(error).lower()
                if 'cancelled' in text:
                    raise
                if len(current) > 1 and ('out of memory' in text or 'cuda' in text):
                    midpoint = max(1, len(current) // 2)
                    return self._forecast_batch_adaptive(current[:midpoint], cancel_event, symbol, exchange, interval) + self._forecast_batch_adaptive(current[midpoint:], cancel_event, symbol, exchange, interval)
                # A backend that cannot batch is still safe to run sequentially.
                results = []
                for item in current:
                    if cancel_event.is_set():
                        raise RuntimeError('calibration cancelled')
                    result, _, _ = self.runtime.forecast(item['bars'], item['timestamps'], symbol=symbol, exchange=exchange, interval=interval, cancel_check=lambda: cancel_event.is_set() and (_raise_cancel()))
                    results.append(result)
                return results

    def status(self, key=None, run_id=None):
        return self.store.status_by_run_id(run_id) if run_id else self.store.status(key)


def _raise_cancel():
    raise RuntimeError('calibration cancelled')
