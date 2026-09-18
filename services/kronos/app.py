from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecast_contract import normalize_predictions, validate_request
from runtime import KronosRuntime

app = FastAPI(title='Layr0 Charts local Kronos forecast service', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5001', 'http://localhost:5001'], allow_methods=['POST'], allow_headers=['Content-Type'])
_runtime = None
_lock = Lock()


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=128)
    exchange: str = Field(min_length=1, max_length=32)
    interval: str = Field(min_length=2, max_length=8)
    bars: list[dict]
    future_timestamps: list[int]


def runtime():
    global _runtime
    with _lock:
        if _runtime is None:
            _runtime = KronosRuntime()
        return _runtime


@app.get('/health')
def health():
    return {'status': 'ok', 'model': 'Kronos-small', 'local_only': True}


@app.post('/v1/forecast')
def forecast(request: ForecastRequest):
    try:
        bars, timestamps = validate_request(request.bars, request.future_timestamps)
        rows = runtime().forecast(bars, timestamps)
        return {'candles': normalize_predictions(rows, timestamps), 'generated_at': datetime.now(timezone.utc).isoformat(), 'model': 'Kronos-small'}
    except (ValueError, RuntimeError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail=f'Kronos inference unavailable: {error}') from error


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8001)
