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

The launcher runs `uv sync` in the existing `services/timesfm/.venv`, prints GPU/PyTorch diagnostics, probes `/health`, reuses a healthy TimesFM process, and starts a new one only when port 8001 is free. It never kills an unknown process. The CUDA-enabled Torch wheel is large (approximately 1.7 GB for the current Windows build) but is downloaded once and reused from `%LOCALAPPDATA%\\uv\\cache`; the model checkpoint is downloaded lazily on the first forecast request.

Manual service commands:

```powershell
uv sync --project services/timesfm
uv run --project services/timesfm python services/timesfm/app.py
```

## Forecast contract

`POST /v1/forecast` receives completed OHLCV bars and ten future timestamps. TimesFM 3 forecasts the four OHLC channels and optional volume channel together. The response contains ten forecast candles and native P10/P25/P50/P75/P90 close quantiles. Native output is returned immediately. The frontend then starts or reuses a 32-origin calibration through `/v1/calibration`; status is polled until ready and the matching calibrated lines are displayed.

Calibration records are stored in `services/timesfm/data/timesfm_calibration.sqlite3`, keyed by symbol, exchange, interval, exact history fingerprint, model revision, and calibration version. Directional calibration adds H1/H3/H5/H10 records containing the quantile-derived raw upward score and the completed future direction. It uses smoothed five-bucket historical estimates and returns a probability only after valid directional outcomes exist. The default 32 outcomes are explicitly labelled low evidence; below that threshold the chart shows no percentage. Native and calibrated quantiles are diagnostic ranges, not success probabilities. Forecasts are informational only and cannot place or modify orders.

Calibration uses bounded batches (`TIMESFM_CALIBRATION_BATCH_SIZE`, default 4) and yields between batches so live forecasts remain responsive. CUDA calibration is optional; the runtime falls back to CPU when `TIMESFM_DEVICE=auto` cannot initialize CUDA. Use `uv run --project services/timesfm python services/timesfm/device_diagnostics.py` or inspect `/health` to see the selected device and VRAM. The NVIDIA display driver and system CUDA Toolkit are not installed or modified by the launcher.

## Verification

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
uv run --project services/timesfm python -m unittest discover -s services/timesfm/tests -v

uv run --project services/timesfm python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())"
npm test
npm run lint
npm run build
```

If port 8001 is occupied, use `netstat -ano | findstr :8001` and `tasklist /FI "PID eq <PID>"`. Stop only the process owned by this application. If the model fails to load, check Python dependencies, available memory, Hugging Face access, `TIMESFM_DEVICE`, and the development-only weights license gate. If CUDA is unavailable, distinguish the NVIDIA driver, system Toolkit, and PyTorch CUDA build: a Toolkit installation alone does not make CPU-only PyTorch use the GPU.
