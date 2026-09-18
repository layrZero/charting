const defaultUrl = 'http://127.0.0.1:8001';

export class KronosForecastError extends Error {
  constructor(message, { code = 'KRONOS_REQUEST_FAILED', status = 0 } = {}) {
    super(message);
    this.name = 'KronosForecastError';
    this.code = code;
    this.status = status;
  }
}

const detailMessage = (payload) => {
  const detail = payload?.detail;
  if (typeof detail === 'string') return { code: payload?.error_code, message: detail };
  if (detail && typeof detail === 'object') return { code: detail.code, message: detail.message };
  return { code: payload?.error_code, message: payload?.message };
};

export const formatKronosError = (payload, status = 0) => {
  const detail = detailMessage(payload);
  return {
    code: detail.code || (status === 422 ? 'INVALID_FORECAST_REQUEST' : 'KRONOS_SERVICE_UNAVAILABLE'),
    message: detail.message || `Kronos forecast failed (${status}).`,
  };
};

export const kronosForecastUrl = () => (import.meta.env?.VITE_KRONOS_FORECAST_URL || defaultUrl).replace(/\/$/, '');

export const requestKronosForecast = async ({ symbol, exchange, interval, bars, futureTimestamps, signal }) => {
  let response;
  try {
    response = await fetch(`${kronosForecastUrl()}/v1/forecast`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, exchange, interval, bars, future_timestamps: futureTimestamps }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new KronosForecastError('Unable to reach the local Kronos service at 127.0.0.1:8001.', { code: 'KRONOS_NETWORK_ERROR' });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = formatKronosError(payload, response.status);
    throw new KronosForecastError(detail.message, { code: detail.code, status: response.status });
  }
  if (!Array.isArray(payload.candles) || payload.candles.length !== 10) throw new KronosForecastError('Kronos did not return ten forecast candles.', { code: 'INVALID_FORECAST_RESPONSE', status: response.status });
  return payload;
};
