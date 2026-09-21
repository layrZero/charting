export const forecastRequestKey = ({ symbol, exchange, interval, bars, futureTimestamps }) => JSON.stringify({
  symbol,
  exchange,
  interval,
  bars,
  futureTimestamps,
});

// Keep the complete key locally for exact deduplication. A 512-bar key is too
// large for the API's request_id field, so use a compact deterministic ID for
// local forecast request coordination.
const hash32 = (value, seed) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const forecastRequestId = (requestOrKey) => {
  const key = typeof requestOrKey === 'string' ? requestOrKey : forecastRequestKey(requestOrKey);
  return `kr-${hash32(key, 0x811c9dc5)}${hash32(key, 0x9e3779b9)}`;
};
