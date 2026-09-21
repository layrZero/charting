"""Local TimesFM 3 runtime for development-only chart forecasts."""
from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
import hashlib
import json
import os
from threading import RLock

import numpy as np

MODEL_ID = os.environ.get('TIMESFM_MODEL_ID', 'google/timesfm-3.0-pytorch')
MODEL_REVISION = os.environ.get('TIMESFM_SOURCE_REVISION', 'v3.0.0')
DEVICE = os.environ.get('TIMESFM_DEVICE', 'cpu')
MAX_CONTEXT = max(1, int(os.environ.get('TIMESFM_MAX_CONTEXT', '512')))
MAX_HORIZON = max(1, int(os.environ.get('TIMESFM_MAX_HORIZON', '10')))
ALLOW_NONCOMMERCIAL_WEIGHTS = os.environ.get('TIMESFM_ALLOW_NONCOMMERCIAL_WEIGHTS', 'true').lower() == 'true'
MAX_CACHE_ENTRIES = 32


def forecast_fingerprint(symbol, exchange, interval, bars, timestamps):
    payload = {'model': MODEL_ID, 'source_revision': MODEL_REVISION, 'device': DEVICE, 'max_context': MAX_CONTEXT, 'max_horizon': MAX_HORIZON, 'symbol': symbol, 'exchange': exchange, 'interval': interval, 'bars': bars, 'timestamps': [int(value) for value in timestamps]}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _finite_array(value):
    array = np.asarray(value, dtype=np.float32)
    if not np.all(np.isfinite(array)):
        raise RuntimeError('TimesFM returned non-finite forecast values.')
    return array


def _ordered_quantiles(value):
    return np.sort(_finite_array(value), axis=-1)


class TimesFMRuntime:
    def __init__(self):
        self._forecaster = None
        self._cache = OrderedDict()
        self._cache_lock = RLock()
        self._state = 'not_loaded'

    @property
    def model_ready(self):
        return self._forecaster is not None

    @property
    def readiness(self):
        return self._state

    def _load(self):
        if self._forecaster is not None:
            return self._forecaster
        self._state = 'loading'
        try:
            if not ALLOW_NONCOMMERCIAL_WEIGHTS:
                raise RuntimeError('TimesFM 3 weights are enabled only for non-commercial development and evaluation.')
            from timesfm3 import ModelConfig, TimesFM3Evaluator
            self._forecaster = TimesFM3Evaluator(ModelConfig(checkpoint_path=MODEL_ID, per_core_batch_size=1, device=DEVICE))
            self._state = 'ready'
            return self._forecaster
        except Exception:
            self._state = 'failed'
            raise

    @staticmethod
    def _context(bars):
        channels = [[float(bar[key]) for bar in bars] for key in ('open', 'high', 'low', 'close')]
        if any('volume' in bar for bar in bars):
            channels.append([float(bar.get('volume') or 0) for bar in bars])
        return np.asarray(channels, dtype=np.float32)

    def forecast(self, bars, timestamps, *, symbol='', exchange='', interval='', cancel_check=None, calibration=None):
        if len(timestamps) != MAX_HORIZON:
            raise ValueError(f'TimesFM must forecast exactly {MAX_HORIZON} candles.')
        fingerprint = forecast_fingerprint(symbol, exchange, interval, bars, timestamps)
        with self._cache_lock:
            cached = self._cache.get(fingerprint)
            if cached is not None:
                self._cache.move_to_end(fingerprint)
                cached_result = json.loads(json.dumps(cached))
                if calibration:
                    offsets = calibration.get('offsets', {})
                    for index, item in enumerate(cached_result['uncertainty']['horizon']):
                        values = {name: float(item['quantiles'][name]) + float(offsets.get(name, [0.0] * len(timestamps))[index]) for name in ('P10', 'P25', 'P50', 'P75', 'P90')}
                        ordered = sorted(values.values())
                        values = dict(zip(('P10', 'P25', 'P50', 'P75', 'P90'), ordered))
                        item.update({'p10': values['P10'], 'p25': values['P25'], 'p50': values['P50'], 'p75': values['P75'], 'p90': values['P90'], 'quantiles': values})
                    cached_result['uncertainty']['display_source'] = 'calibrated'
                    cached_result['uncertainty']['calibration_status'] = 'ready'
                return cached_result, True, fingerprint
        if cancel_check:
            cancel_check()
        context = self._context(bars[-MAX_CONTEXT:])
        outputs = list(self._load().predict_batch(contexts=[context], horizon=len(timestamps), return_quantiles=True, use_symmetric_averaging=False))
        if cancel_check:
            cancel_check()
        if not outputs:
            raise RuntimeError('TimesFM returned no forecast output.')
        output = outputs[0]
        point_value = getattr(output, 'forecast', None) if not isinstance(output, dict) else output.get('forecast')
        quantile_value = getattr(output, 'quantiles', None) if not isinstance(output, dict) else output.get('quantiles')
        point = _finite_array(point_value)
        quantiles = _ordered_quantiles(quantile_value)
        if point.ndim == 1:
            point = point[None, :]
        if quantiles.ndim == 2:
            quantiles = quantiles[None, :, :]
        if point.shape[0] < 4 or point.shape[1] != len(timestamps) or quantiles.shape[:2] != (point.shape[0], len(timestamps)):
            raise RuntimeError('TimesFM returned an invalid multivariate horizon.')
        quantile_names = ('P10', 'P25', 'P50', 'P75', 'P90')
        close_quantiles = {name: quantiles[3, :, index] for name, index in zip(quantile_names, (0, 1, 4, 7, 8))}
        native_offsets = (calibration or {}).get('offsets', {})
        calibrated_quantiles = {
            name: np.asarray(values, dtype=np.float64) + np.asarray(native_offsets.get(name, [0.0] * len(timestamps)), dtype=np.float64)
            for name, values in close_quantiles.items()
        } if calibration else None
        selected_quantiles = calibrated_quantiles or close_quantiles
        selected_quantiles = {name: np.asarray(values, dtype=np.float64) for name, values in selected_quantiles.items()}
        for index in range(len(timestamps)):
            ordered = sorted(selected_quantiles[name][index] for name in quantile_names)
            for name, value in zip(quantile_names, ordered):
                selected_quantiles[name][index] = value
        previous_close = float(bars[-1]['close'])
        candles, horizon = [], []
        for index, timestamp in enumerate(timestamps):
            open_value, close_value = float(point[0, index]), float(point[3, index])
            high_value = max(float(point[1, index]), open_value, close_value)
            low_value = min(float(point[2, index]), open_value, close_value)
            volume_value = max(0.0, float(point[4, index])) if point.shape[0] > 4 else 0.0
            candles.append({'time': int(timestamp), 'open': open_value, 'high': high_value, 'low': low_value, 'close': close_value, 'volume': volume_value})
            median_close = float(selected_quantiles['P50'][index])
            horizon.append({'timestamp': int(timestamp), 'p10': float(selected_quantiles['P10'][index]), 'p25': float(selected_quantiles['P25'][index]), 'p50': median_close, 'p75': float(selected_quantiles['P75'][index]), 'p90': float(selected_quantiles['P90'][index]), 'quantiles': {name: float(selected_quantiles[name][index]) for name in quantile_names}, 'direction': 'up' if median_close >= previous_close else 'down', 'directional_agreement': None, 'up_members': None, 'down_members': None})
            previous_close = median_close
        result = {'candles': candles, 'uncertainty': {'horizon': horizon, 'ensemble_size': 1, 'quantile_source': 'timesfm-native', 'calibration_status': 'ready' if calibration else 'not-run', 'display_source': 'calibrated' if calibration else 'native', 'native_quantiles': {name: [float(value) for value in values] for name, values in close_quantiles.items()}, 'calibrated_quantiles': {name: [float(value) for value in values] for name, values in calibrated_quantiles.items()} if calibrated_quantiles else None}, 'generated_at': datetime.now(timezone.utc).isoformat(), 'model': 'TimesFM-3.0'}
        with self._cache_lock:
            self._cache[fingerprint] = json.loads(json.dumps(result))
            self._cache.move_to_end(fingerprint)
            while len(self._cache) > MAX_CACHE_ENTRIES:
                self._cache.popitem(last=False)
        return result, False, fingerprint
