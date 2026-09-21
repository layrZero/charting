// IMC history is authoritative for completed candles. Poll often enough to
// pick up a newly closed bar without turning the browser into a tight loop.
export const AUTHORITATIVE_REFRESH_INTERVAL_MS = 15_000;
