# Extending OpenAlgo Charts

Use `openalgo-charts/widget` for chart chrome. It owns drawing tools,
indicators, dialogs and mobile controls. Do not introduce another
lightweight-charts lifecycle or revive the old line-tools plugin.

Extend market data through `ImcMarketDataFeed` and broker operations through
`ImcClient`, preserving IMC endpoint names and execution-mode preconditions.
The workspace is versioned; future migrations must be additive and must not
read legacy `tv_*` keys under this clean-start policy.
