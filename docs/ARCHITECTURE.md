# Architecture

```text
Browser / React terminal :5001
  ├─ IMC REST/WebSocket ──> published IMC gateway :8080
  └─ completed OHLCV only ──> local TimesFM service :8001
                                  └─ TimesFM 3.0 native quantiles
```

The Charts application is independent of the IMC frontend. IMC remains authoritative for actual candles, options, quotes, portfolio data, and all order mutations. The local forecast service is read-only and never receives credentials or creates orders.

The forecast service exposes only `/health` and `/v1/forecast`. Its source is pinned to TimesFM `v3.0.0`; its default checkpoint is `google/timesfm-3.0-pytorch`. The runtime maps completed OHLCV channels to TimesFM’s multivariate input and maps native deciles to P10/P50/P90. Forecast candles remain separate chart-engine series.

Calibration, HMM regime analysis, ensemble sampling, and walk-forward jobs are not part of this architecture. Native quantiles are uncertainty diagnostics, not calibrated probabilities. The default TimesFM 3 weights are development-only under their current license.
