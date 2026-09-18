import test from 'node:test';
import assert from 'node:assert/strict';
import { IMC_DEFAULTS, resolveImcConfig } from '../src/services/imcConfig.js';

const storage = (values = {}) => ({
  values: { ...values },
  getItem(key) { return this.values[key] ?? null; },
  setItem(key, value) { this.values[key] = value; },
});

test('browser settings take precedence over build-time environment values', () => {
  const browser = storage({
    imc_api_url: 'http://127.0.0.1:8080',
    imc_ws_url: 'ws://127.0.0.1:8080/ws',
    imc_apikey: 'browser-key',
  });
  const config = resolveImcConfig({ storage: browser, env: {
    VITE_IMC_API_URL: 'http://127.0.0.1:5000',
    VITE_IMC_WS_URL: 'ws://127.0.0.1:8765/ws',
  } });

  assert.deepEqual(config, {
    apiUrl: 'http://127.0.0.1:8080',
    wsUrl: 'ws://127.0.0.1:8080/ws',
    apiKey: 'browser-key',
  });
});

test('legacy local values migrate to the published gateway', () => {
  const browser = storage({
    imc_api_url: 'http://127.0.0.1:5000',
    imc_ws_url: 'ws://127.0.0.1:8765/ws',
  });
  const config = resolveImcConfig({ storage: browser, env: {} });

  assert.deepEqual(config, { ...IMC_DEFAULTS, apiKey: '' });
  assert.equal(browser.values.imc_api_url, IMC_DEFAULTS.apiUrl);
  assert.equal(browser.values.imc_ws_url, IMC_DEFAULTS.wsUrl);
});

test('custom remote endpoints are never overwritten', () => {
  const browser = storage({
    imc_api_url: 'https://imc.example.test',
    imc_ws_url: 'wss://imc.example.test/ws',
  });
  const config = resolveImcConfig({ storage: browser, env: {
    VITE_IMC_API_URL: IMC_DEFAULTS.apiUrl,
    VITE_IMC_WS_URL: IMC_DEFAULTS.wsUrl,
  } });

  assert.equal(config.apiUrl, 'https://imc.example.test');
  assert.equal(config.wsUrl, 'wss://imc.example.test/ws');
  assert.equal(browser.values.imc_api_url, 'https://imc.example.test');
  assert.equal(browser.values.imc_ws_url, 'wss://imc.example.test/ws');
});
