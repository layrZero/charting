import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDepth, normalizeHistory } from '../src/services/imcClient.js';
test('normalizes IMC history', () => { const bars = normalizeHistory({ data: [{ timestamp: '2026-01-02T09:15:00Z', open: '10', high: '12', low: '9', close: '11', volume: '20', oi: '5' }] }); assert.equal(bars[0].close, 11); assert.equal(bars[0].oi, 5); });
test('normalizes IMC depth', () => { const depth = normalizeDepth({ ltp: '123.4', depth: { bids: [{ price: '123', qty: '2' }], asks: [{ price: '124', quantity: '3' }] } }); assert.equal(depth.ltp, 123.4); assert.equal(depth.bids[0].qty, 2); assert.equal(depth.asks[0].qty, 3); });
