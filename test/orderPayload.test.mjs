import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlaceOrderPayload, createBrowserRequestId } from '../src/services/orderPayload.js';
import { defaultWorkspace } from '../src/services/workspace.js';

const active = { symbol: 'RPOWER', exchange: 'NSE' };
const mode = { mode: 'live', balance_type: 'live', mode_version: 7 };
const marketOrder = { strategy: '  RPOWER-5m-manual  ', action: 'BUY', product: 'MIS', pricetype: 'MARKET', quantity: '2', price: '', triggerPrice: '' };

test('builds the exact IMC market-order fields with a trimmed strategy', () => {
  const payload = buildPlaceOrderPayload({ active, order: marketOrder, mode, requestId: 'request-1' });
  assert.deepEqual(payload, { strategy: 'RPOWER-5m-manual', symbol: 'RPOWER', exchange: 'NSE', action: 'BUY', product: 'MIS', pricetype: 'MARKET', quantity: 2, expected_mode: 'live', expected_balance_type: 'live', expected_mode_version: 7, request_id: 'request-1' });
  assert.equal('mode_version' in payload, false);
  assert.equal('apikey' in payload, false);
});

test('validates IMC price and trigger requirements by order type', () => {
  assert.throws(() => buildPlaceOrderPayload({ active, mode, requestId: 'limit', order: { ...marketOrder, pricetype: 'LIMIT' } }), /Limit price is required|Limit price must be greater than zero/);
  assert.throws(() => buildPlaceOrderPayload({ active, mode, requestId: 'sl', order: { ...marketOrder, pricetype: 'SL', price: 10 } }), /Trigger price is required|Trigger price must be greater than zero/);
  assert.throws(() => buildPlaceOrderPayload({ active, mode, requestId: 'slm', order: { ...marketOrder, pricetype: 'SL-M' } }), /Trigger price is required|Trigger price must be greater than zero/);
  assert.deepEqual(buildPlaceOrderPayload({ active, mode, requestId: 'sl-ready', order: { ...marketOrder, pricetype: 'SL', price: 10, triggerPrice: 9 } }), { strategy: 'RPOWER-5m-manual', symbol: 'RPOWER', exchange: 'NSE', action: 'BUY', product: 'MIS', pricetype: 'SL', quantity: 2, expected_mode: 'live', expected_balance_type: 'live', expected_mode_version: 7, request_id: 'sl-ready', price: 10, trigger_price: 9 });
});

test('requires strategy and the complete IMC mode snapshot', () => {
  assert.throws(() => buildPlaceOrderPayload({ active, mode, requestId: 'no-strategy', order: { ...marketOrder, strategy: ' ' } }), /Strategy is required/);
  assert.throws(() => buildPlaceOrderPayload({ active, mode: { mode: 'live', mode_version: 7 }, requestId: 'no-balance', order: marketOrder }), /IMC balance type is required/);
  assert.equal(defaultWorkspace.trading.strategy, '');
  assert.equal(defaultWorkspace.version, 6);
});

test('creates a fresh cryptographic request ID for every order click', () => {
  const first = createBrowserRequestId();
  const second = createBrowserRequestId();
  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/i);
});
