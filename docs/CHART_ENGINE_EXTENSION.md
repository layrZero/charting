# Chart-engine extension

The chart-engine owns actual broker candles, indicators, drawings, and series lifecycle. The TimesFM 3 overlay is an application-owned series added beside the actual candle series. It is removed on symbol, exchange, interval, or widget teardown.

The overlay consumes only completed IMC history. It never uses LTP/depth messages to manufacture candles. Native TimesFM P10/P90 close quantiles are rendered as separate range lines, while P50 multivariate output supplies the forecast candle values.

Keep the visible wording `TimesFM 3 forecast — not trading advice` and `Native P10–P90 quantile range — not a success probability` when extending this feature. Do not connect forecast output to order generation, signals, or portfolio mutations.
