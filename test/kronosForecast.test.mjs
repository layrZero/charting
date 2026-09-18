import test from 'node:test';
import assert from 'node:assert/strict';
import { formatKronosError } from '../src/services/kronosForecast.js';

test('formats structured Kronos validation errors without object coercion', () => {
  assert.deepEqual(formatKronosError({ detail: { code: 'INVALID_FORECAST_REQUEST', message: 'future timestamps are invalid' } }, 422), {
    code: 'INVALID_FORECAST_REQUEST',
    message: 'future timestamps are invalid',
  });
});

test('formats structured Kronos runtime errors without exposing internals', () => {
  const result = formatKronosError({ detail: { code: 'KRONOS_INFERENCE_FAILED', message: 'Kronos could not generate a forecast.' } }, 503);
  assert.equal(result.code, 'KRONOS_INFERENCE_FAILED');
  assert.equal(result.message.includes('[object Object]'), false);
});
