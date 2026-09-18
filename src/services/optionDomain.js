const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((month, index) => [month, index]));

const field = (value) => value && typeof value === 'object' ? value.expiry ?? value.expiry_date ?? value.date ?? value.value : value;

export const normalizeExpiry = (input) => {
  const raw = String(field(input) ?? '').trim().toUpperCase();
  let match = /^(\d{2})-([A-Z]{3})-(\d{2}|\d{4})$/.exec(raw) || /^(\d{2})([A-Z]{3})(\d{2}|\d{4})$/.exec(raw);
  if (!match) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (iso) {
      const year = Number(iso[1]); const month = Number(iso[2]); const day = Number(iso[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCDate() === day && date.getUTCMonth() === month - 1) {
          const value = `${String(day).padStart(2, '0')}${MONTHS[month - 1]}${String(year).slice(-2)}`;
          return { value, display: `${day} ${MONTHS[month - 1]} '${String(year).slice(-2)}`, timestamp: date.getTime() };
        }
      }
    }
    throw new Error(`Invalid option expiry: ${raw || 'empty'}`);
  }
  const day = Number(match[1]); const month = MONTH_INDEX[match[2]]; const yearNumber = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + yearNumber : yearNumber;
  const date = new Date(Date.UTC(year, month, day));
  if (month === undefined || date.getUTCDate() !== day || date.getUTCMonth() !== month) throw new Error(`Invalid option expiry: ${raw}`);
  const value = `${String(day).padStart(2, '0')}${MONTHS[month]}${String(year).slice(-2)}`;
  return { value, display: `${day} ${MONTHS[month]} '${String(year).slice(-2)}`, timestamp: date.getTime() };
};

export const formatExpiryForImc = (value) => normalizeExpiry(value).value;

export const normalizeExpiryList = (payload) => {
  const values = payload?.expiries || payload?.data || payload || [];
  return [...new Map((Array.isArray(values) ? values : []).map((value) => {
    try { const normalized = normalizeExpiry(value); return [normalized.value, normalized]; } catch { return null; }
  }).filter(Boolean))].map(([, value]) => value).sort((a, b) => a.timestamp - b.timestamp);
};

const number = (value, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
const contract = (value, exchange) => value ? ({
  symbol: value.symbol || value.tradingsymbol || value.option_symbol || '', exchange,
  label: value.label || '', ltp: number(value.ltp ?? value.last_price), bid: number(value.bid), ask: number(value.ask),
  oi: number(value.oi), volume: number(value.volume), lotsize: number(value.lotsize ?? value.lot_size), tickSize: number(value.tick_size ?? value.tickSize),
}) : null;

export const normalizeOptionChain = (payload, optionsExchange = 'NFO') => {
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : payload || {};
  const expiryInfo = normalizeExpiry(data.expiry_date || data.expiry || '');
  return {
    underlying: data.underlying || data.symbol || '', underlyingExchange: data.underlying_exchange || '', optionsExchange,
    expiry: expiryInfo.value, expiryDisplay: expiryInfo.display, spot: number(data.underlying_ltp ?? data.underlyingLTP ?? data.ltp),
    atmStrike: number(data.atm_strike ?? data.atmStrike),
    rows: (Array.isArray(data.chain) ? data.chain : []).map((row) => ({ strike: number(row.strike), ce: contract(row.ce, optionsExchange), pe: contract(row.pe, optionsExchange) }))
      .filter((row) => Number.isFinite(row.strike)).sort((a, b) => a.strike - b.strike),
  };
};

export const resolveOptionExchange = (exchange = '') => ['BFO', 'BSE', 'BSE_INDEX'].includes(String(exchange).toUpperCase()) ? 'BFO' : 'NFO';

export const resolveOptionUnderlying = ({ symbol = '', exchange = '' } = {}) => {
  const cleanSymbol = String(symbol).trim().toUpperCase();
  const option = /^(.+?)(\d{2}[A-Z]{3}\d{2})(\d+(?:\.\d+)?)(CE|PE)$/.exec(cleanSymbol);
  return { symbol: option ? option[1] : cleanSymbol, exchange: resolveOptionExchange(exchange), expiry: option ? normalizeExpiry(option[2]).value : '' };
};
