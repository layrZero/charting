export const forecastRequestKey = ({ symbol, exchange, interval, bars, futureTimestamps }) => JSON.stringify({
  symbol,
  exchange,
  interval,
  bars,
  futureTimestamps,
});
