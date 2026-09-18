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

## Prerequisites and startup

The local stack supports Windows, Git Bash, Linux, and macOS. Install:

- Node.js 20+ and npm.
- `uv` 0.5+ for Python environment and dependency management.
- Git, for the pinned Kronos source checkout.
- Python 3.10+ available through `uv`.
- A reachable India Market Connector instance and a valid API key.

The frontend uses port `5001`; the local Kronos API uses `127.0.0.1:8001`.
For the current IMC Docker development stack, the browser-facing gateway is
port `8080`:

```text
REST:      http://127.0.0.1:8080
WebSocket: ws://127.0.0.1:8080/ws
```

Ports `5000` and `8765` are container-internal ports and must not be entered
in the browser connection dialog. Browser-saved connection settings take
precedence over `.env.local`; restart Vite after changing environment files.
IMC REST and WebSocket URLs are configured separately in the application.

First-time setup on Windows:

```bat
npm install
copy .env.example .env.local
start.bat
```

First-time setup in Bash or Git Bash:

```bash
npm install
cp .env.example .env.local
bash start.sh
```

The startup script runs `uv sync`, verifies the pinned Kronos checkout, starts
the forecast API, and starts the Vite frontend plus signal receiver. Open
`http://localhost:5001`. Enter the IMC REST URL, WebSocket URL, and API key in
the connection settings dialog. Credentials stay in browser storage and are
never sent to Kronos.

For manual startup, use two terminals:

```bash
uv sync --project services/kronos
uv run --project services/kronos python services/kronos/bootstrap.py
uv run --project services/kronos python services/kronos/app.py
```

In the second terminal:

```bash
npm run dev
```

Check the forecast service with `http://127.0.0.1:8001/health`. Stop the Bash
launcher with `Ctrl+C`; on Windows, close the Charts terminal and the separate
`Layr0 Kronos` window. The first forecast request downloads the configured
Kronos-small model from Hugging Face and may take longer.

Use the settings icon to provide the IMC REST URL, WebSocket URL, and API key.
The key remains in browser storage and is sent only to the configured IMC
server. Old local development values using ports `5000` and `8765` are
automatically migrated to the published `8080` gateway; custom remote URLs
are not changed. Configure IMC CORS for the terminal's origin when necessary.

Run `npm run build` to create `dist/`. Serve it over HTTPS and set the two
`VITE_IMC_*` variables at build time, or use the connection dialog.

## State policy

This is a clean-start migration. New state uses
`layr0_openalgo_workspace_v2`; legacy `tv_*` chart data is neither read,
converted, nor deleted.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local development and startup](docs/LOCAL_DEVELOPMENT.md)
- [IMC integration contract](docs/IMC_INTEGRATION.md)
- [Options and trading workflow](docs/OPTIONS_AND_TRADING.md)
- [Chart engine extension guide](docs/CHART_ENGINE_EXTENSION.md)

The chart engine is internal source under `src/chart-engine`. Product code
imports only the Layer Zero aliases such as `@layr0/chart-engine/widget`.
Required third-party attribution is retained in `THIRD_PARTY_NOTICES.md`.

Never commit credentials. Verify live order behavior in non-production IMC
before a production rollout.

## Local Kronos forecast service

The ten-candle forecast is local-only and all Python commands use `uv`.
`services/kronos/pyproject.toml` and `services/kronos/uv.lock` define the
reproducible environment. The source checkout is pinned to the commit recorded
in `services/kronos/kronos.lock`.

The Vite app calls `VITE_KRONOS_FORECAST_URL` (default
`http://127.0.0.1:8001`). The service receives normalized completed OHLCV bars
only and never receives an IMC API key or broker credentials. It forecasts ten
future candles, refreshes broker history at each expected completion, and rolls
the horizon forward. Connection settings offer either only the next ten bars or
fulfilled violet/amber hollow forecast outlines over the actual candle.

Forecasts are informational only and never place orders. No production routing
or deployment configuration is included in this branch.

If `uv` is missing, install it before starting. If bootstrap fails, confirm
GitHub access and run `uv run --project services/kronos python
services/kronos/bootstrap.py` again. If port 8001 or 5001 is occupied, stop the
existing process or change the local service configuration before restarting.
If the chart has no data, verify that IMC is running, its REST/WebSocket URLs
are correct, and the API key is valid.
