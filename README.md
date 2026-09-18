# Layr0 Charts

Layr0 Charts is an independent, responsive trading terminal. Its Layer Zero
chart engine is integrated into this private repository, while India Market
Connector (IMC) supplies market-data and trading services. It does not embed
or import the IMC frontend.

## Capabilities

- Interactive charts, indicators, drawings and touch controls from the
  internal Layer Zero chart engine.
- IMC history, symbol search, live market data and depth subscriptions.
- Expiry-driven option chain and selected CE/PE charting.
- Analyzer/live-mode-aware order entry plus portfolio snapshots.
- Complete Chart, Options, Trade and Portfolio workflows on desktop, tablet,
  and phone.

## Setup

Node.js 20+ and an accessible IMC instance are required.

```sh
cp .env.example .env.local
npm install
npm run dev
```

Use the settings icon to provide the IMC REST URL, WebSocket URL, and API key.
The key remains in browser storage and is sent only to the configured IMC
server. Configure IMC CORS for the terminal's origin when necessary.

Run `npm run build` to create `dist/`. Serve it over HTTPS and set the two
`VITE_IMC_*` variables at build time, or use the connection dialog.

## State policy

This is a clean-start migration. New state uses
`layr0_openalgo_workspace_v2`; legacy `tv_*` chart data is neither read,
converted, nor deleted.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [IMC integration contract](docs/IMC_INTEGRATION.md)
- [Options and trading workflow](docs/OPTIONS_AND_TRADING.md)
- [Chart engine extension guide](docs/CHART_ENGINE_EXTENSION.md)

The chart engine is internal source under `src/chart-engine`. Product code
imports only the Layer Zero aliases such as `@layr0/chart-engine/widget`.
Required third-party attribution is retained in `THIRD_PARTY_NOTICES.md`.

Never commit credentials. Verify live order behavior in non-production IMC
before a production rollout.

## Local Kronos forecast service

The ten-candle forecast is local-only. Install Python 3.10+, create a virtual
environment for `services/kronos`, install its requirements, then fetch the
pinned Kronos source and start the service in a second terminal:

```sh
python -m venv services/kronos/.venv
services/kronos/.venv/Scripts/pip install -r services/kronos/requirements.txt
npm run forecast:bootstrap
npm run forecast:dev
```

The Vite app calls `VITE_KRONOS_FORECAST_URL` (default
`http://127.0.0.1:8001`). The service receives normalized completed OHLCV bars
only and never receives an IMC API key or broker credentials. It forecasts ten
future candles, refreshes broker history at each expected completion, and rolls
the horizon forward. Connection settings offer either only the next ten bars or
fulfilled violet/amber hollow forecast outlines over the actual candle.

Forecasts are informational only and never place orders. No production routing
or deployment configuration is included in this branch.
