# Extending the Layer Zero chart engine

`src/chart-engine` is an internal engine implementation. Application code uses
the `@layr0/chart-engine` aliases, including `/widget`, `/indicators`, `/draw`,
`/transform`, `/profile`, and `/trade`.

Keep IMC-specific market data in `ImcMarketDataFeed` and order operations in
`ImcClient`; do not couple application endpoints into the engine. Preserve
the workspace versioning policy and do not reintroduce reads of legacy `tv_*`
state. Legal attribution for the incorporated source is kept in the repository
third-party notices, separate from product documentation.
