# Architecture

```text
Browser / React terminal :5001
  ├─ IMC REST/WebSocket ──> published IMC gateway :8080
  └─ completed OHLCV only ──> local TimesFM service :8001
                                  ├─ TimesFM 3.0 native quantiles
                                  └─ SQLite calibration records
```

The Charts application is independent of the IMC frontend. IMC remains authoritative for actual candles, options, quotes, portfolio data, and all order mutations. The local forecast service is read-only and never receives credentials or creates orders.

The forecast service exposes forecast, calibration, and health endpoints. Its source is pinned to TimesFM `v3.0.0`; its default checkpoint is `google/timesfm-3.0-pytorch`. The runtime maps completed OHLCV channels to TimesFM’s multivariate input and retains five key native quantiles. A single local calibration worker evaluates 32 chronological origins in bounded batches and persists adjustments in SQLite. Forecast candles and quantile lines remain separate chart-engine series. Device selection is local to the sidecar: `auto` prefers a usable PyTorch CUDA device and falls back to CPU.

Calibration is per complete symbol/exchange/interval/history context. Native quantiles are shown immediately; calibrated lines replace them after a successful run. Quantiles are uncertainty diagnostics, not guaranteed probabilities. The default TimesFM 3 weights are development-only under their current license.
