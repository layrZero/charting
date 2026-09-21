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
uv sync --project services/kronos
uv run --project services/kronos python services/kronos/app.py
```

## Forecast contract

`POST /v1/forecast` receives completed OHLCV bars and ten future timestamps. TimesFM 3 forecasts the four OHLC channels and optional volume channel together. The response contains ten forecast candles and native P10/P50/P90 close quantiles. No calibration, HMM, ensemble, or walk-forward request is made.

Native quantile ranges are not success probabilities. Forecasts are informational only and cannot place or modify orders.

## Verification

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
uv run --project services/kronos python -m unittest discover -s services/kronos/tests -v
npm test
npm run lint
npm run build
```

If port 8001 is occupied, use `netstat -ano | findstr :8001` and `tasklist /FI "PID eq <PID>"`. Stop only the process owned by this application. If the model fails to load, check Python dependencies, available memory, Hugging Face access, `TIMESFM_DEVICE`, and the development-only weights license gate.
