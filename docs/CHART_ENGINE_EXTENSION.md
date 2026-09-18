# Extending the Layer Zero chart engine

`src/chart-engine` is an internal engine implementation. Application code uses
the `@layr0/chart-engine` aliases, including `/widget`, `/indicators`, `/draw`,
`/transform`, `/profile`, and `/trade`.

Keep IMC-specific market data in `ImcMarketDataFeed` and order operations in
`ImcClient`; do not couple application endpoints into the engine. Preserve
the workspace versioning policy and do not reintroduce reads of legacy `tv_*`
state. Legal attribution for the incorporated source is kept in the repository
third-party notices, separate from product documentation.

## Built-in indicators

The indicator tier is opt-in inside the internal engine. The Vite bootstrap
imports `@layr0/chart-engine/indicators` and registers the complete built-in
descriptor manifest before rendering React. This makes every copied OpenAlgo
indicator available to the Indicators picker and chart widgets. New indicators
must be added to that internal tier and covered by registry and rendering
tests; do not import an external chart package or create a second registry.

## Forecast-series extension

The Kronos overlay uses the public Layer Zero chart-engine API only. The
terminal creates two `candlestick` series on the primary price pane: a
semi-transparent violet/amber future series and, when enabled, a hollow
violet/amber fulfilled-forecast series. Both are removed during widget
teardown, so they do not alter drawings, indicators, or saved chart state.

The overlay is available only while the local Kronos API is running on port
8001. Start the complete stack with `start.sh` or `start.bat`, or start the
Kronos process manually with the `uv run` commands in
`docs/LOCAL_DEVELOPMENT.md`.
