import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimesFMError } from '../src/services/timesfmForecast.js';

test('formats structured TimesFM validation errors without object coercion', () => {
  assert.deepEqual(formatTimesFMError({ detail: { code: 'INVALID_FORECAST_REQUEST', message: 'future timestamps are invalid' } }, 422), { code: 'INVALID_FORECAST_REQUEST', message: 'future timestamps are invalid' });
});

test('formats TimesFM runtime errors without exposing internals', () => {
  const result = formatTimesFMError({ detail: { code: 'TIMESFM_INFERENCE_FAILED', message: 'TimesFM could not generate a forecast.' } }, 503);
  assert.equal(result.code, 'TIMESFM_INFERENCE_FAILED');
  assert.equal(result.message.includes('object Object'), false);
});

test('formats schema validation arrays as readable field errors', () => {
  assert.deepEqual(formatTimesFMError({ detail: [{ loc: ['body', 'request_id'], msg: 'String should have at most 128 characters' }] }, 422), { code: 'TIMESFM_REQUEST_SCHEMA_INVALID', message: 'request_id: String should have at most 128 characters' });
});
