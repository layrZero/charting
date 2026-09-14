# Architecture

Layr0 Charts has three boundaries: the React/Vite terminal shell owns layout,
workspace and panels; the internal Layer Zero chart engine owns canvas
rendering, drawings, indicators and touch chart controls; IMC owns market
data, options, execution mode, orders and investment data.

`ImcClient` owns REST contracts. `ImcMarketDataFeed` converts IMC history and
WebSocket data to chart-engine feeds. `ImcTradeAdapter` is the basic trade bridge;
extended actions remain explicit IMC client calls so mode preconditions are not
lost.

Included scope is charting, options, trading and portfolio APIs. Broker setup,
operations dashboards, logs, monitoring, licensing and other IMC admin
surfaces are excluded. Desktop uses concurrent panels; tablet stacks panels;
phones provide one full-height panel selected from the tab bar.

The internal engine source is in `src/chart-engine`. Vite aliases expose only
`@layr0/chart-engine` and its tiers; no application code imports an external
chart package.
