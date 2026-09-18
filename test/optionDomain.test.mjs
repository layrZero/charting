import test from 'node:test';
import assert from 'node:assert/strict';
import { formatExpiryForImc, normalizeExpiry, normalizeExpiryList, normalizeOptionChain, resolveOptionExchange, resolveOptionUnderlying } from '../src/services/optionDomain.js';

test('normalizes IMC expiry formats to DDMMMYY', () => {
  assert.equal(formatExpiryForImc('31-JUL-25'), '31JUL25');
  assert.equal(formatExpiryForImc('31JUL25'), '31JUL25');
  assert.equal(formatExpiryForImc('2025-07-31'), '31JUL25');
  assert.equal(normalizeExpiry({ expiry_date: '31-JUL-25' }).display, "31 JUL '25");
});

test('sorts and deduplicates expiry response data', () => {
  const values = normalizeExpiryList({ data: ['31-JUL-25', '07-AUG-25', '31JUL25', 'bad'] });
  assert.deepEqual(values.map((item) => item.value), ['31JUL25', '07AUG25']);
});

test('normalizes chain rows and contract fields', () => {
  const chain = normalizeOptionChain({ underlying: 'NIFTY', underlying_ltp: '24000', atm_strike: '24000', expiry_date: '31-JUL-25', chain: [{ strike: '24000', ce: { symbol: 'NIFTY31JUL2524000CE', label: 'ATM', ltp: '100', oi: '20' }, pe: { symbol: 'NIFTY31JUL2524000PE', ltp: '90', volume: '30' } }] });
  assert.equal(chain.expiry, '31JUL25'); assert.equal(chain.spot, 24000); assert.equal(chain.atmStrike, 24000);
  assert.equal(chain.rows[0].ce.exchange, 'NFO'); assert.equal(chain.rows[0].ce.oi, 20); assert.equal(chain.rows[0].pe.volume, 30);
});

test('maps derivative exchanges and active option symbols', () => {
  assert.equal(resolveOptionExchange('BSE_INDEX'), 'BFO');
  assert.equal(resolveOptionExchange('NSE'), 'NFO');
  assert.deepEqual(resolveOptionUnderlying({ symbol: 'BHARTIARTL', exchange: 'NSE' }), { symbol: 'BHARTIARTL', exchange: 'NFO', expiry: '' });
  assert.deepEqual(resolveOptionUnderlying({ symbol: 'NIFTY31JUL2524000CE', exchange: 'NFO' }), { symbol: 'NIFTY', exchange: 'NFO', expiry: '31JUL25' });
});

test('rejects malformed expiry values', () => {
  assert.throws(() => normalizeExpiry('not-an-expiry'), /Invalid option expiry/);
});
