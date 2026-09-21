from __future__ import annotations

from datetime import datetime, timezone
import logging
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecast_contract import normalize_predictions, validate_request
from request_manager import RequestManager, StaleAnalyticsRequest
from runtime import MODEL_ID, TimesFMRuntime

app = FastAPI(title='Layr0 Charts local TimesFM forecast service', version='2.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5001', 'http://localhost:5001'], allow_methods=['POST'], allow_headers=['Content-Type'])
_runtime = None
_lock = Lock()
_request_manager = RequestManager()
logger = logging.getLogger('layr0.timesfm')


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=128)
    exchange: str = Field(min_length=1, max_length=32)
    interval: str = Field(min_length=2, max_length=8)
    bars: list[dict]
    future_timestamps: list[int]
    request_id: str | None = Field(default=None, max_length=128)


def runtime():
    global _runtime
    with _lock:
        if _runtime is None:
            _runtime = TimesFMRuntime()
        return _runtime


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
        result, cache_hit, fingerprint = runtime().forecast(bars, timestamps, symbol=request.symbol, exchange=request.exchange, interval=request.interval, cancel_check=lease.ensure_current)
        lease.ensure_current()
        return {'candles': normalize_predictions(result['candles'], timestamps), 'uncertainty': result['uncertainty'], 'generated_at': result.get('generated_at') or datetime.now(timezone.utc).isoformat(), 'model': 'TimesFM-3.0', 'input_fingerprint': fingerprint, 'cache_hit': cache_hit}
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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
