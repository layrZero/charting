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

## Kronos forecast data flow

The forecast extension consumes existing IMC contracts only: `search` selects
the symbol/exchange, `history` supplies authenticated broker OHLCV data, and
`market/holidays` supplies calendar exclusions. No IMC endpoint or backend
code is changed. WebSocket LTP is never converted into an authoritative candle.

Live validation remains a read-only external gate requiring a supplied IMC URL
and API key. It must exercise search, history, holidays, and the displayed ten
predictions without placing an order.
