# Layr0 Charts

Independent responsive React/Vite charting application backed by India Market Connector (IMC). Actual candles, option chains, trading, portfolio data, indicators, drawings, and order workflows remain IMC/chart-engine features. The local TimesFM 3 service provides informational forecast overlays only.

## Prerequisites and startup

Install Node.js 20+, npm, Git, and `uv`. Python is managed by `uv` and must be 3.10+. IMC must be running and reachable through its published gateway, normally `http://127.0.0.1:8080`; do not use container-internal ports.

```powershell
npm install
copy .env.example .env.local
start.bat
```

Git Bash/Linux/macOS:

```bash
npm install
cp .env.example .env.local
./start.sh
```

The launcher runs TimesFM on `127.0.0.1:8001` and Vite on `localhost:5001`. Re-running it reuses a healthy TimesFM service and never terminates an unknown process. The first forecast downloads and loads the `google/timesfm-3.0-pytorch` checkpoint and may take several minutes.

Manual service startup:

```powershell
uv sync --project services/kronos
uv run --project services/kronos python services/kronos/app.py
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

## TimesFM 3 forecast service

The service uses TimesFM source revision `v3.0.0` and checkpoint `google/timesfm-3.0-pytorch`. It receives normalized completed OHLCV candles and future timestamps only. It returns ten multivariate OHLCV candles plus native TimesFM P10/P50/P90 quantile ranges. It does not receive IMC credentials, place orders, generate signals, or convert LTP ticks into candles.

The local endpoints are `GET /health` and `POST /v1/forecast`. There is no automatic calibration, walk-forward backtest, HMM regime endpoint, or forecast-confidence probability. Native quantile ranges are uncertainty diagnostics, not a probability that a forecast will succeed.

## Licensing boundary

TimesFM source is Apache-2.0. The default TimesFM 3 pretrained weights are currently distributed under a separate non-commercial license and are restricted to non-commercial, non-production use. This integration is local development/evaluation only. Production or commercial use requires an approved alternative license or service before deployment.

## Configuration

```env
VITE_FORECAST_URL=http://127.0.0.1:8001
TIMESFM_MODEL_ID=google/timesfm-3.0-pytorch
TIMESFM_SOURCE_REVISION=v3.0.0
TIMESFM_DEVICE=cpu
TIMESFM_MAX_CONTEXT=512
TIMESFM_MAX_HORIZON=10
TIMESFM_ALLOW_NONCOMMERCIAL_WEIGHTS=true
```

## Verification

```powershell
uv sync --project services/kronos
uv run --project services/kronos python -m unittest discover -s services/kronos/tests -v
npm test
npm run lint
npm run build
```

If port 8001 is occupied, inspect ownership with `netstat -ano | findstr :8001` and `tasklist /FI "PID eq <PID>"`. Stop only the process you own. No India Market Connector files are changed by this project.
