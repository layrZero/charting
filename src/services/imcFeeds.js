import { ImcClient, normalizeHistory, normalizeDepth } from './imcClient';

const date = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10);

export class ImcMarketDataFeed {
  constructor(client = new ImcClient()) { this.client = client; }
  async getBars({ symbol, exchange, interval, from, to, signal }) {
    const now = Math.floor(Date.now() / 1000);
    const payload = await this.client.history({ symbol, exchange, interval, start_date: date(from || now - 86400 * 365), end_date: date(to || now) }, { signal });
    return normalizeHistory(payload);
  }
  subscribeBars({ symbol, exchange }, onBar) {
    return this.subscribe({ symbol, exchange, mode: 1 }, (data) => {
      const price = Number(data.ltp ?? data.last_price ?? data.last);
      if (Number.isFinite(price)) onBar({ time: Math.floor(Date.now() / 1000), open: price, high: price, low: price, close: price, volume: Number(data.volume || 0) });
    });
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
