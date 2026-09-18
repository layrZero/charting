import test from 'node:test';
import assert from 'node:assert/strict';
import { ImcClient, normalizeDepth, normalizeHistory } from '../src/services/imcClient.js';
import { ImcMarketDataFeed } from '../src/services/imcFeeds.js';
test('normalizes IMC history', () => { const bars = normalizeHistory({ data: [{ timestamp: '2026-01-02T09:15:00Z', open: '10', high: '12', low: '9', close: '11', volume: '20', oi: '5' }] }); assert.equal(bars[0].close, 11); assert.equal(bars[0].oi, 5); });
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
