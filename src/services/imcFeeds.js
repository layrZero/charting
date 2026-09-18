import { ImcClient, normalizeHistory, normalizeDepth, utcSecondsToImcDate } from './imcClient.js';

const historyWindow = (from, to) => ({ start_date: utcSecondsToImcDate(from), end_date: utcSecondsToImcDate(to) });

export class ImcMarketDataFeed {
  constructor(client = new ImcClient()) { this.client = client; }
  async getBars({ symbol, exchange, interval, from, to, signal }) {
    const now = Math.floor(Date.now() / 1000);
    const start = from ?? now - 86400 * 365;
    const end = to ?? now;
    const payload = await this.client.history({ symbol, exchange, interval, ...historyWindow(start, end) }, { signal });
    return normalizeHistory(payload);
  }
  async getBarsPage({ symbol, exchange, interval, from, to, before, signal }) {
    const end = Math.min(to ?? before, before);
    const start = from ?? end - 86400 * 30;
    const bars = await this.getBars({ symbol, exchange, interval, from: start, to: end, signal });
    const older = bars.filter((bar) => bar.time < before);
    return {
      bars: older,
      nextBefore: older[0]?.time ?? Math.min(before - 1, end - 1),
      hasMore: undefined,
    };
  }
  subscribeBars() {
    // IMC's browser stream is LTP/quote data, not a broker-authored OHLC bar.
    // Do not manufacture candles from ticks: the forecast controller refreshes
    // authoritative history at completed-candle boundaries instead.
    return () => {};
  }
  subscribeDepth({ symbol, exchange }, onDepth, { depthLevel = 5 } = {}) { return this.subscribe({ symbol, exchange, mode: 3, depth: depthLevel }, (data) => onDepth(normalizeDepth(data))); }
  subscribe(subscription, onData) {
    const { wsUrl, apiKey } = this.client.config;
    let closed = false; let socket; let timer;
    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => socket.send(JSON.stringify({ action: 'authenticate', api_key: apiKey }));
      socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if ((message.type === 'auth' && message.status === 'success') || message.type === 'authenticated') socket.send(JSON.stringify({ action: 'subscribe', ...subscription }));
        else if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
        else if (message.type === 'market_data' || message.symbol === subscription.symbol) onData(message.data || message);
      };
      socket.onclose = () => { if (!closed) timer = setTimeout(connect, 1500); };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'unsubscribe', symbol: subscription.symbol, exchange: subscription.exchange })); socket?.close(); };
  }
}

export class ImcTradeAdapter {
  constructor(client = new ImcClient()) { this.client = client; }
  async place(order) { const result = await this.client.placeOrder(order); return { orderId: result.orderid || result.order_id }; }
  async modify(orderId, patch) { await this.client.modifyOrder({ orderid: orderId, ...patch }); }
  async cancel(orderId) { await this.client.cancelOrder({ orderid: orderId }); }
}
