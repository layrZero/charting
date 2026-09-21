from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from calibration import CalibrationManager, context_key
from calibration_store import CalibrationStore
from forecast_contract import normalize_predictions, validate_bars, validate_request
from request_manager import RequestManager, StaleAnalyticsRequest
from runtime import MODEL_ID, TimesFMRuntime

app = FastAPI(title='Layr0 Charts local TimesFM forecast service', version='2.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5001', 'http://localhost:5001'], allow_methods=['POST'], allow_headers=['Content-Type'])
_runtime = None
_lock = Lock()
_request_manager = RequestManager()
_store = CalibrationStore(Path(__file__).parent / 'data' / 'timesfm_calibration.sqlite3')
_calibration = None
logger = logging.getLogger('layr0.timesfm')


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=128)
    exchange: str = Field(min_length=1, max_length=32)
    interval: str = Field(min_length=2, max_length=8)
    bars: list[dict]
    future_timestamps: list[int]
    request_id: str | None = Field(default=None, max_length=128)
    calibration_context_key: str | None = Field(default=None, max_length=128)


class CalibrationRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=128)
    exchange: str = Field(min_length=1, max_length=32)
    interval: str = Field(min_length=2, max_length=8)
    bars: list[dict]
    future_timestamps: list[int] = Field(default_factory=list)
    request_id: str | None = Field(default=None, max_length=128)


def runtime():
    global _runtime
    with _lock:
        if _runtime is None:
            _runtime = TimesFMRuntime()
        return _runtime


def calibration_manager():
    global _calibration
    with _lock:
        if _calibration is None:
            _calibration = CalibrationManager(_store, runtime())
        return _calibration


@app.get('/health')
def health():
    active = runtime()
    return {'status': 'ok', 'model': 'TimesFM-3.0', 'model_id': MODEL_ID, 'model_ready': active.model_ready, 'readiness': active.readiness, 'weights_license': 'non-commercial-development-only', 'local_only': True}


@app.post('/v1/forecast')
def forecast(request: ForecastRequest):
    try:
        bars, timestamps = validate_request(request.bars, request.future_timestamps)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_FORECAST_REQUEST', 'message': str(error)}) from error
    lease = None
    try:
        request_id = request.request_id or f'{request.symbol}:{request.exchange}:{request.interval}'
        lease = _request_manager.acquire(f'{request.symbol}:{request.exchange}', request_id)
        key = context_key(request.symbol, request.exchange, request.interval, bars)
        calibration_key = request.calibration_context_key or key
        stored = _store.get_ready(calibration_key, ttl_seconds=24 * 3600, minimum_new_bars=16, current_bar_count=len(bars))
        offsets = None
        if stored:
            offsets = {name: [stored['offsets'].get(str(index + 1), {}).get(name, 0.0) for index in range(len(timestamps))] for name in ('P10', 'P25', 'P50', 'P75', 'P90')}
        result, cache_hit, fingerprint = runtime().forecast(bars, timestamps, symbol=request.symbol, exchange=request.exchange, interval=request.interval, cancel_check=lease.ensure_current, calibration={'offsets': offsets} if offsets else None)
        lease.ensure_current()
        response = {'candles': normalize_predictions(result['candles'], timestamps), 'uncertainty': result['uncertainty'], 'generated_at': result.get('generated_at') or datetime.now(timezone.utc).isoformat(), 'model': 'TimesFM-3.0', 'input_fingerprint': fingerprint, 'cache_hit': cache_hit}
        if stored:
            response['uncertainty']['calibration_run_id'] = stored.get('run_id')
            response['uncertainty']['calibration_context_key'] = calibration_key
        return response
    except StaleAnalyticsRequest as error:
        raise HTTPException(status_code=409, detail={'code': 'STALE_FORECAST_REQUEST', 'message': str(error)}) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_FORECAST_REQUEST', 'message': str(error)}) from error
    except Exception as error:
        logger.exception('TimesFM inference failed')
        raise HTTPException(status_code=503, detail={'code': 'TIMESFM_INFERENCE_FAILED', 'message': 'TimesFM could not generate a forecast.'}) from error
    finally:
        if lease is not None:
            _request_manager.release(lease)


@app.post('/v1/calibration')
def start_calibration(request: CalibrationRequest):
    try:
        bars = validate_bars(request.bars, max_count=2048)
        if len(bars) < 106:
            raise ValueError('at least 106 completed candles are required for calibration')
        return calibration_manager().start(symbol=request.symbol, exchange=request.exchange, interval=request.interval, bars=bars, timestamps=request.future_timestamps)
    except ValueError as error:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_CALIBRATION_REQUEST', 'message': str(error)}) from error


@app.get('/v1/calibration/status')
def calibration_status(context: str):
    return calibration_manager().status(context) or {'status': 'not-run'}


@app.post('/v1/calibration/refresh')
def refresh_calibration(request: CalibrationRequest):
    try:
        bars = validate_bars(request.bars, max_count=2048)
        if len(bars) < 106:
            raise ValueError('at least 106 completed candles are required for calibration')
        key = context_key(request.symbol, request.exchange, request.interval, bars)
        _store.invalidate(key)
        return calibration_manager().start(symbol=request.symbol, exchange=request.exchange, interval=request.interval, bars=bars, timestamps=request.future_timestamps)
    except ValueError as error:
        raise HTTPException(status_code=422, detail={'code': 'INVALID_CALIBRATION_REQUEST', 'message': str(error)}) from error


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
