import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastRequestKey, forecastRequestId } from '../src/services/forecastIdentity.js';

const request = (overrides = {}) => ({
  symbol: 'NIFTY', exchange: 'NSE_INDEX', interval: '5m',
  bars: [{ time: 100, open: 10, high: 11, low: 9, close: 10.5, volume: 2 }],
  futureTimestamps: [400, 700], ...overrides,
});

test('forecast request identity is stable for identical inputs', () => {
  assert.equal(forecastRequestKey(request()), forecastRequestKey(request()));
});

test('forecast request identity changes with symbol, interval, candles, and horizon', () => {
  const base = forecastRequestKey(request());
  assert.notEqual(base, forecastRequestKey(request({ symbol: 'BANKNIFTY' })));
  assert.notEqual(base, forecastRequestKey(request({ interval: '15m' })));
  assert.notEqual(base, forecastRequestKey(request({ bars: [{ ...request().bars[0], close: 11 }] })));
  assert.notEqual(base, forecastRequestKey(request({ futureTimestamps: [700, 1000] })));
});

test('forecast request id is a compact stable derivative of the complete request key', () => {
  const bars = Array.from({ length: 512 }, (_, time) => ({ time, open: 1, high: 2, low: 0, close: 1.5 }));
  const key = forecastRequestKey(request({ bars }));
  const id = forecastRequestId(key);
  assert.match(id, /^kr-[a-f0-9]{16}$/);
  assert.ok(id.length < 128);
  assert.equal(id, forecastRequestId(key));
  assert.notEqual(id, forecastRequestId(forecastRequestKey(request({ symbol: 'BANKNIFTY' }))));
});
