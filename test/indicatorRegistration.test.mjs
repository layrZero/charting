import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
const tier = fs.readFileSync(path.join(root, 'src/chart-engine/indicators/index.ts'), 'utf8');

test('application bootstraps the internal built-in indicator tier', () => {
  assert.match(main, /chart-engine\/indicators/);
  assert.match(main, /registerBuiltinIndicators\(\)/);
});

test('indicator tier registers representative built-ins and remains idempotent', () => {
  for (const name of ['SMA', 'EMA', 'RSI', 'MACD', 'BOLLINGER', 'ATR', 'SUPERTREND', 'VWAP', 'VOLUME']) {
    assert.match(tier, new RegExp(`\\b${name}\\b`));
  }
  assert.match(tier, /if \(_registered\) return/);
  assert.match(tier, /102 Tier-1 built-ins/);
  assert.match(tier, /export const BUILTIN_INDICATORS/);
});
