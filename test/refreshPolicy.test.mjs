import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTHORITATIVE_REFRESH_INTERVAL_MS } from '../src/services/refreshPolicy.js';

test('authoritative IMC history refresh is enabled at a bounded cadence', () => {
  assert.equal(AUTHORITATIVE_REFRESH_INTERVAL_MS, 15_000);
  assert.ok(AUTHORITATIVE_REFRESH_INTERVAL_MS >= 5_000);
  assert.ok(AUTHORITATIVE_REFRESH_INTERVAL_MS <= 60_000);
});

test('production chart terminal passes the refresh cadence to the engine', () => {
  const source = fs.readFileSync(path.resolve('src/components/OpenAlgoTerminal/ChartTerminal.jsx'), 'utf8');
  assert.match(source, /loading: \{ pollIntervalMs: AUTHORITATIVE_REFRESH_INTERVAL_MS \}/);
});
