const defaultUrl = 'http://127.0.0.1:8001';

export const kronosForecastUrl = () => (import.meta.env.VITE_KRONOS_FORECAST_URL || defaultUrl).replace(/\/$/, '');

export const requestKronosForecast = async ({ symbol, exchange, interval, bars, futureTimestamps, signal }) => {
  const response = await fetch(`${kronosForecastUrl()}/v1/forecast`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, exchange, interval, bars, future_timestamps: futureTimestamps }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.message || 'Kronos forecast failed.');
  if (!Array.isArray(payload.candles) || payload.candles.length !== 10) throw new Error('Kronos did not return ten forecast candles.');
  return payload;
};
