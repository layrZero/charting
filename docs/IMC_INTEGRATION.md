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
