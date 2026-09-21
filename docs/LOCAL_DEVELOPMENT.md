# Local development

## Process topology

Run IMC separately on its published gateway, then start the Charts frontend and local TimesFM service. The browser uses IMC at `http://127.0.0.1:8080` and TimesFM at `http://127.0.0.1:8001`. IMC credentials are entered in the browser and never sent to TimesFM.

## Startup

```powershell
npm install
copy .env.example .env.local
start.bat
```

```bash
npm install
cp .env.example .env.local
./start.sh
```

The launcher runs `uv sync`, probes `/health`, reuses a healthy TimesFM process, and starts a new one only when port 8001 is free. It never kills an unknown process. The model checkpoint is downloaded lazily on the first forecast request.

Manual service commands:

```powershell
uv sync --project services/timesfm
uv run --project services/timesfm python services/timesfm/app.py
```

## Forecast contract

`POST /v1/forecast` receives completed OHLCV bars and ten future timestamps. TimesFM 3 forecasts the four OHLC channels and optional volume channel together. The response contains ten forecast candles and native P10/P25/P50/P75/P90 close quantiles. Native output is returned immediately. The frontend then starts or reuses a 32-origin calibration through `/v1/calibration`; status is polled until ready and the matching calibrated lines are displayed.

Calibration records are stored in `services/timesfm/data/timesfm_calibration.sqlite3`, keyed by symbol, exchange, interval, exact history fingerprint, model revision, and calibration version. Native and calibrated quantiles are diagnostic ranges, not success probabilities. Forecasts are informational only and cannot place or modify orders.

## Verification

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
uv run --project services/timesfm python -m unittest discover -s services/timesfm/tests -v
npm test
npm run lint
npm run build
```

If port 8001 is occupied, use `netstat -ano | findstr :8001` and `tasklist /FI "PID eq <PID>"`. Stop only the process owned by this application. If the model fails to load, check Python dependencies, available memory, Hugging Face access, `TIMESFM_DEVICE`, and the development-only weights license gate.
