# Layr0 Charts

Layr0 Charts is an independent, responsive trading terminal. It uses OpenAlgo
Charts 2.2 for rendering and India Market Connector (IMC) as its market-data
and trading backend. It does not embed or import the IMC frontend.

## Capabilities

- OpenAlgo 2.2 interactive charts, indicators, drawings and touch controls.
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
`layr0_openalgo_workspace_v1`; legacy `tv_*` chart data is neither read,
converted, nor deleted.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [IMC integration contract](docs/IMC_INTEGRATION.md)
- [Options and trading workflow](docs/OPTIONS_AND_TRADING.md)
- [OpenAlgo extension guide](docs/OPENALGO_EXTENSION.md)

Never commit credentials. Verify live order behavior in non-production IMC
before a production rollout.
