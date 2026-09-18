/**
 * India Market Connector client used by the independent chart terminal.
 * No IMC frontend code is imported here: this is the browser-side contract.
 */
const defaultApiUrl = 'http://127.0.0.1:5000';
const defaultWsUrl = 'ws://127.0.0.1:8765/ws';

export const imcConfig = () => ({
  apiUrl: (import.meta.env.VITE_IMC_API_URL || localStorage.getItem('imc_api_url') || defaultApiUrl).replace(/\/$/, ''),
  wsUrl: import.meta.env.VITE_IMC_WS_URL || localStorage.getItem('imc_ws_url') || defaultWsUrl,
  apiKey: localStorage.getItem('imc_apikey') || '',
});

export class ImcError extends Error {
  constructor(message, status, body) { super(message); this.name = 'ImcError'; this.status = status; this.body = body; }
}

export class ImcClient {
  constructor(config = imcConfig()) { this.config = config; }
  get apiKey() { return this.config.apiKey; }

  async request(path, body = {}, { signal } = {}) {
    const response = await fetch(`${this.config.apiUrl}/api/v1/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ apikey: this.apiKey, ...body }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.status === 'error') throw new ImcError(payload.message || `IMC ${path} failed`, response.status, payload);
    return payload;
  }

  history(input, options) { return this.request('history', input, options); }
  quotes(symbol, exchange) { return this.request('quotes', { symbol, exchange }); }
  multiQuotes(symbols) { return this.request('multiquotes', { symbols }); }
  depth(symbol, exchange) { return this.request('depth', { symbol, exchange }); }
  search(query, exchange) { return this.request('search', { query, exchange }); }
  symbol(symbol, exchange) { return this.request('symbol', { symbol, exchange }); }
  instruments(exchange) { return this.request('instruments', { exchange }); }
  ticker(symbol, exchange) { return this.request('ticker', { symbol, exchange }); }
  intervals() { return this.request('intervals'); }
  marketTimings(date) { return this.request('market/timings', { date }); }
  marketHolidays(year) { return this.request('market/holidays', year ? { year } : {}); }
  expiry(symbol, exchange, instrumenttype = 'options') { return this.request('expiry', { symbol, exchange, instrumenttype }); }
  optionChain(underlying, exchange, expiry_date, strike_count = 15) { return this.request('optionchain', { underlying, exchange, expiry_date, strike_count }); }
  optionSymbol(input) { return this.request('optionsymbol', input); }
  optionGreeks(input) { return this.request('optiongreeks', input); }
  syntheticFuture(input) { return this.request('syntheticfuture', input); }
  funds() { return this.request('funds'); }
  margin(input) { return this.request('margin', input); }
  orderBook() { return this.request('orderbook'); }
  tradeBook() { return this.request('tradebook'); }
  positionBook() { return this.request('positionbook'); }
  holdings() { return this.request('holdings'); }
  pnl() { return this.request('pnl'); }
  strategy(input = {}) { return this.request('strategy', input); }
  orderStatus(orderid) { return this.request('orderstatus', { orderid }); }
  chartPreferences() { return this.request('chart', {}); }
  saveChartPreferences(preferences) { return this.request('chart', { preferences }); }
  analyzer() { return this.request('analyzer', {}); }
  placeOrder(input) { return this.request('placeorder', input); }
  modifyOrder(input) { return this.request('modifyorder', input); }
  cancelOrder(input) { return this.request('cancelorder', input); }
  closePosition(input) { return this.request('closeposition', input); }
  cancelAllOrders(input = {}) { return this.request('cancelallorder', input); }
  smartOrder(input) { return this.request('placesmartorder', input); }
  basketOrder(input) { return this.request('basketorder', input); }
  splitOrder(input) { return this.request('splitorder', input); }
  optionsOrder(input) { return this.request('optionsorder', input); }
  optionsMultiOrder(input) { return this.request('optionsmultiorder', input); }
  gttOrder(input) { return this.request('placegttorder', input); }
  gttOrderBook() { return this.request('gttorderbook', {}); }
  modifyGttOrder(input) { return this.request('modifygttorder', input); }
  cancelGttOrder(input) { return this.request('cancelgttorder', input); }
}

export const normalizeHistory = (payload) => (payload.data || []).map((row) => ({
  time: Math.floor(new Date(row.timestamp || row.datetime || row.date).getTime() / 1000) || Number(row.timestamp),
  open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close), volume: Number(row.volume || 0), oi: Number(row.oi || 0),
})).filter((bar) => Number.isFinite(bar.time) && Number.isFinite(bar.close));

export const normalizeDepth = (message) => ({
  timeSec: Math.floor(Number(message.timestamp || Date.now()) / (Number(message.timestamp) > 1e12 ? 1000 : 1)),
  ltp: Number(message.ltp ?? message.last_price ?? message.last ?? 0),
  bids: (message.bids || message.depth?.bids || []).map((x) => ({ price: Number(x.price), qty: Number(x.quantity ?? x.qty), orders: Number(x.orders || 0) })),
  asks: (message.asks || message.depth?.asks || []).map((x) => ({ price: Number(x.price), qty: Number(x.quantity ?? x.qty), orders: Number(x.orders || 0) })),
});
