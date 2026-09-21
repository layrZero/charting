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

The launcher runs TimesFM on `127.0.0.1:8001` and Vite on `localhost:5001`. Re-running it reuses a healthy TimesFM service and never terminates an unknown process. It uses the existing `services/timesfm/.venv` and shared uv cache; it does not create a second Python environment. On this development machine the pinned PyTorch build includes CUDA support for the RTX 3050, while runtime selection still falls back safely to CPU. The first forecast downloads and loads the `google/timesfm-3.0-pytorch` checkpoint and may take several minutes.

Manual service startup:

```powershell
uv sync --project services/timesfm
uv run --project services/timesfm python services/timesfm/app.py
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

## TimesFM 3 forecast service

The service uses TimesFM source revision `v3.0.0` and checkpoint `google/timesfm-3.0-pytorch`. It receives normalized completed OHLCV candles and future timestamps only. It returns ten multivariate OHLCV candles plus native P10/P25/P50/P75/P90 quantile ranges. It does not receive IMC credentials, place orders, generate signals, or convert LTP ticks into candles.

At startup, `TIMESFM_DEVICE=auto` selects CUDA when the installed PyTorch build can initialize the NVIDIA GPU; otherwise it reports a CPU fallback. `/health` exposes the requested and selected device, GPU name, PyTorch CUDA build, and VRAM without credentials. `TIMESFM_REQUIRE_CUDA=true` turns an unavailable CUDA device into a clear startup failure. The CUDA runtime is supplied by the pinned PyTorch wheel; the system CUDA Toolkit is used for diagnostics and is not copied into the repository.

The local endpoints are `GET /health`, `POST /v1/forecast`, `POST /v1/calibration`, `GET /v1/calibration/status`, and `POST /v1/calibration/refresh`. Native forecasts appear immediately. A local 32-origin walk-forward calibration runs asynchronously per symbol, exchange, interval, and history fingerprint, and is stored in `services/timesfm/data/timesfm_calibration.sqlite3`. Calibrated quantiles replace native display lines after completion.

The completed calibration also reports a directional estimate for H1, H3, H5, and H10. It combines the native quantile distribution with completed historical outcomes for the same symbol, exchange, and interval. The chart shows the estimated direction, a smoothed historical probability, an 80% uncertainty interval, and the evidence count. With the default 32 outcomes this is labelled **low evidence**; it is not a guarantee, investment advice, trade signal, or order input. A numeric percentage is intentionally hidden until directional calibration is ready.

## Licensing boundary

TimesFM source is Apache-2.0. The default TimesFM 3 pretrained weights are currently distributed under a separate non-commercial license and are restricted to non-commercial, non-production use. This integration is local development/evaluation only. Production or commercial use requires an approved alternative license or service before deployment.

## Configuration

```env
VITE_FORECAST_URL=http://127.0.0.1:8001
TIMESFM_MODEL_ID=google/timesfm-3.0-pytorch
TIMESFM_SOURCE_REVISION=v3.0.0
TIMESFM_DEVICE=auto
TIMESFM_REQUIRE_CUDA=false
TIMESFM_CUDA_MEMORY_FRACTION=0.85
TIMESFM_MAX_CONTEXT=512
TIMESFM_MAX_HORIZON=10
TIMESFM_ALLOW_NONCOMMERCIAL_WEIGHTS=true
TIMESFM_CALIBRATION_TTL_HOURS=24
TIMESFM_CALIBRATION_MIN_NEW_BARS=16
TIMESFM_CALIBRATION_ORIGINS=32
TIMESFM_CALIBRATION_BATCH_SIZE=4
TIMESFM_CALIBRATION_MAX_SECONDS=600
TIMESFM_CALIBRATION_DEVICE=auto
TIMESFM_CALIBRATION_VERSION=1
TIMESFM_DIRECTIONAL_CALIBRATION_VERSION=1
```

The chart displays P10, P25, P50, P75, and P90 as separate lines. P50 also supplies the forecast candle median. Calibration is retriggered after the TTL, a material history change, a model/configuration change, or an explicit refresh. The SQLite file is local-only and contains no credentials.

## Direct terminal orders

The Order ticket submits one IMC `placeorder` request only after refreshing the current analyzer/live snapshot. A non-empty, user-defined strategy label is mandatory; it is retained locally in the browser and identifies the IMC exposure group used for reconciliation. The terminal sends IMC's current mode preconditions (`expected_mode`, `expected_balance_type`, `expected_mode_version`, and a fresh `request_id`) with every order. It does not retry failed write requests automatically. An IMC submission acknowledgement is not a broker fill confirmation.

## Verification

```powershell
uv sync --project services/timesfm
uv run --project services/timesfm python -m unittest discover -s services/timesfm/tests -v
npm test
npm run lint
npm run build
```

If port 8001 is occupied, inspect ownership with `netstat -ano | findstr :8001` and `tasklist /FI "PID eq <PID>"`. Stop only the process you own. No India Market Connector files are changed by this project.
