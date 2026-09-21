# Chart-engine extension

The chart-engine owns actual broker candles, indicators, drawings, and series lifecycle. The TimesFM 3 overlay is an application-owned series added beside the actual candle series. It is removed on symbol, exchange, interval, or widget teardown.

The overlay consumes only completed IMC history. It never uses LTP/depth messages to manufacture candles. Native TimesFM P10/P25/P50/P75/P90 close quantiles are rendered as separate lines. P10 and P90 are the outer estimated outcome boundaries, P25 and P75 are inner boundaries, and P50 is the median/central forecast. A local SQLite-backed walk-forward calibration can replace those lines with calibrated diagnostics, while P50 multivariate output supplies the forecast candle values.

Keep the visible wording `TimesFM 3 forecast — not trading advice` and explain whether the chart is showing native or historically calibrated quantiles. Do not call either range a guaranteed probability or connect forecast output to order generation, signals, or portfolio mutations.
