import test from 'node:test';
import assert from 'node:assert/strict';
import { ImcClient, normalizeDepth, normalizeHistory, normalizeImcTimestamp, utcSecondsToImcDate } from '../src/services/imcClient.js';
import { ImcMarketDataFeed } from '../src/services/imcFeeds.js';
test('normalizes IMC history', () => { const bars = normalizeHistory({ data: [{ timestamp: '2026-01-02T09:15:00Z', open: '10', high: '12', low: '9', close: '11', volume: '20', oi: '5' }] }); assert.equal(bars[0].close, 11); assert.equal(bars[0].oi, 5); });
test('normalizes epoch seconds and milliseconds without producing 1970 dates', () => {
  const seconds = 1767345300;
  assert.equal(normalizeImcTimestamp(seconds), seconds);
  assert.equal(normalizeImcTimestamp(String(seconds)), seconds);
  assert.equal(normalizeImcTimestamp(seconds * 1000), seconds);
});
test('parses unqualified IMC timestamps as IST and formats request dates in IST', () => {
  assert.equal(normalizeImcTimestamp('2026-01-02 09:15:00'), 1767325500);
  assert.equal(utcSecondsToImcDate(1767325500), '2026-01-02');
  assert.equal(utcSecondsToImcDate(1767281400), '2026-01-01');
});
test('normalizes invalid history rows without silently creating invalid candles', () => {
  const bars = normalizeHistory({ data: [{ timestamp: 1767345300, open: '10', high: '12', low: '9', close: '11' }, { timestamp: 'bad', close: '20' }] });
  assert.equal(bars.length, 1);
  assert.equal(bars[0].time, 1767345300);
});
test('requests older history pages from IMC using the exclusive cursor', async () => {
  const calls = [];
  const client = { history: async (input) => { calls.push(input); return { data: [{ timestamp: 1767325500, open: 1, high: 2, low: 1, close: 2 }, { timestamp: 1767411900, open: 2, high: 3, low: 2, close: 3 }] }; } };
  const page = await new ImcMarketDataFeed(client).getBarsPage({ symbol: 'NIFTY', exchange: 'NSE_INDEX', interval: '5m', from: 1767000000, to: 1767400000, before: 1767400000, countBack: 500 });
  assert.equal(page.bars.length, 1);
  assert.equal(page.nextBefore, 1767325500);
  assert.deepEqual(calls[0], { symbol: 'NIFTY', exchange: 'NSE_INDEX', interval: '5m', start_date: '2025-12-29', end_date: '2026-01-03' });
});
test('normalizes IMC depth', () => { const depth = normalizeDepth({ ltp: '123.4', depth: { bids: [{ price: '123', qty: '2' }], asks: [{ price: '124', quantity: '3' }] } }); assert.equal(depth.ltp, 123.4); assert.equal(depth.bids[0].qty, 2); assert.equal(depth.asks[0].qty, 3); });
test('does not manufacture an OHLC candle from an LTP stream', () => {
  const unsubscribe = new ImcMarketDataFeed({ config: {} }).subscribeBars({ symbol: 'NIFTY', exchange: 'NSE_INDEX' }, () => { throw new Error('synthetic candle'); });
  assert.equal(typeof unsubscribe, 'function');
});
test('preserves IMC error code and message in request failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'error', error_code: 'INVALID_API_KEY', message: 'Invalid API key',
  }), { status: 403, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      () => new ImcClient({ apiUrl: 'http://127.0.0.1:8080', wsUrl: 'ws://127.0.0.1:8080/ws', apiKey: 'test-key' }).history({ symbol: 'NIFTY' }),
      (error) => error.status === 403 && error.message === 'Invalid API key [INVALID_API_KEY]' && error.body.error_code === 'INVALID_API_KEY',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('renders structured IMC messages without object coercion', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: 'error', error_code: 'INVALID_REQUEST', message: { date: ['Date is required'] },
  }), { status: 422, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      () => new ImcClient({ apiUrl: 'http://127.0.0.1:8080', wsUrl: 'ws://127.0.0.1:8080/ws', apiKey: 'test-key' }).marketTimings(),
      (error) => error.message === 'date: ["Date is required"] [INVALID_REQUEST]' && !error.message.includes('[object Object]'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('classifies network failures without exposing credentials', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try {
    await assert.rejects(
      () => new ImcClient({ apiUrl: 'http://127.0.0.1:8080', wsUrl: 'ws://127.0.0.1:8080/ws', apiKey: 'secret-key' }).history({ symbol: 'NIFTY' }),
      (error) => error.status === 0 && error.body.error_code === 'IMC_NETWORK_OR_CORS_ERROR' && !error.message.includes('secret-key'),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sends the complete validated order body only to IMC', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ status: 'success', orderid: 'order-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const client = new ImcClient({ apiUrl: 'http://127.0.0.1:8080', wsUrl: 'ws://127.0.0.1:8080/ws', apiKey: 'test-key' });
    await client.placeOrder({ strategy: 'Manual-RPOWER', symbol: 'RPOWER', exchange: 'NSE', action: 'BUY', product: 'MIS', pricetype: 'MARKET', quantity: 1, expected_mode: 'live', expected_balance_type: 'live', expected_mode_version: 7, request_id: 'request-1' });
    assert.equal(requestBody.strategy, 'Manual-RPOWER');
    assert.equal(requestBody.expected_mode_version, 7);
    assert.equal(requestBody.mode_version, undefined);
    assert.equal(requestBody.apikey, 'test-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
