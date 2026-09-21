const defaultUrl = 'http://127.0.0.1:8001';

export class TimesFMForecastError extends Error {
  constructor(message, { code = 'TIMESFM_REQUEST_FAILED', status = 0 } = {}) { super(message); this.name = 'TimesFMForecastError'; this.code = code; this.status = status; }
}

const detailMessage = (payload) => {
  const detail = payload?.detail;
  if (typeof detail === 'string') return { code: payload?.error_code, message: detail };
  if (Array.isArray(detail)) { const first = detail[0] || {}; const location = Array.isArray(first.loc) ? first.loc.filter((part) => part !== 'body').join('.') : ''; return { code: 'TIMESFM_REQUEST_SCHEMA_INVALID', message: `${location || 'request'}: ${first.msg || 'invalid request'}` }; }
  if (detail && typeof detail === 'object') return { code: detail.code, message: detail.message };
  return { code: payload?.error_code, message: payload?.message };
};

export const formatTimesFMError = (payload, status = 0) => {
  const detail = detailMessage(payload);
  return { code: detail.code || (status === 422 ? 'INVALID_FORECAST_REQUEST' : 'TIMESFM_SERVICE_UNAVAILABLE'), message: detail.message || `TimesFM forecast failed (${status}).` };
};

export const timesFMForecastUrl = () => (import.meta.env?.VITE_FORECAST_URL || defaultUrl).replace(/\/$/, '');

export const requestTimesFMForecast = async ({ symbol, exchange, interval, bars, futureTimestamps, requestId, signal }) => {
  let response;
  try { response = await fetch(`${timesFMForecastUrl()}/v1/forecast`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, exchange, interval, bars, future_timestamps: futureTimestamps, request_id: requestId }) }); }
  catch (error) { if (error?.name === 'AbortError') throw error; throw new TimesFMForecastError('Unable to reach the local TimesFM service at 127.0.0.1:8001.', { code: 'TIMESFM_NETWORK_ERROR' }); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const detail = formatTimesFMError(payload, response.status); throw new TimesFMForecastError(detail.message, { code: detail.code, status: response.status }); }
  if (!Array.isArray(payload.candles) || payload.candles.length !== 10) throw new TimesFMForecastError('TimesFM did not return ten forecast candles.', { code: 'INVALID_FORECAST_RESPONSE', status: response.status });
  if (!payload.uncertainty || !Array.isArray(payload.uncertainty.horizon) || payload.uncertainty.horizon.length !== 10) throw new TimesFMForecastError('TimesFM returned an invalid native quantile horizon.', { code: 'INVALID_FORECAST_RESPONSE', status: response.status });
  return payload;
};
