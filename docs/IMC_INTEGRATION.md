# IMC integration contract

REST calls use `POST /api/v1/<endpoint>` with `apikey`. `ImcClient` converts
non-2xx and `status: error` responses to `ImcError`.

| Domain | Endpoints |
|---|---|
| Chart | `history`, `quotes`, `multiquotes`, `depth`, `search`, `intervals` |
| Options | `expiry`, `optionchain`, `optionsymbol`, `optiongreeks`, `syntheticfuture` |
| Trading | `analyzer`, order, smart/basket/split/options, and GTT endpoints |
| Portfolio | `funds`, `margin`, `orderbook`, `tradebook`, `positionbook`, `holdings`, `pnl`, `chart` |

WebSocket authentication is `{ action: "authenticate", api_key }`; then
subscriptions are `{ action: "subscribe", symbol, exchange, mode }`. Mode 1
drives candles and mode 3 depth. The adapter responds to ping and reconnects.

Read `analyzer` before writes. The server is authoritative: include
`expected_mode` and `mode_version` whenever IMC provides them. Never retry a
rejected write automatically.

## TimesFM forecast data flow

The forecast extension consumes existing IMC contracts only: `search` selects
the symbol/exchange, `history` supplies authenticated broker OHLCV data, and
`market/holidays` supplies calendar exclusions. No IMC endpoint or backend
code is changed. WebSocket LTP is never converted into an authoritative candle.

Live validation remains a read-only external gate requiring a supplied IMC URL
and API key. It must exercise search, history, holidays, and the displayed ten
predictions without placing an order.

## Completed-candle refresh

The chart engine polls IMC history every 15 seconds. This is the authoritative
completed-candle refresh path because the browser WebSocket feed is used for
quotes/depth and is not converted into synthetic OHLC candles. A new broker
candle is merged by timestamp, preserving the chart viewport, drawings, and
indicators. Polling pauses while the browser tab is hidden and resumes when it
becomes visible.

TimesFM forecasting is independent of this refresh loop. A forecast failure,
calendar failure, or unavailable TimesFM process must not stop broker history
from refreshing.

Local startup must start IMC separately, then run the Charts launcher. Configure
the IMC REST and WebSocket URLs and API key in the browser connection dialog.
The launcher only starts the local Charts and TimesFM processes; it does not
start, modify, or deploy India Market Connector.
