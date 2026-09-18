const GATEWAY_API_URL = 'http://127.0.0.1:8080';
const GATEWAY_WS_URL = 'ws://127.0.0.1:8080/ws';

const LEGACY_API_URLS = new Set([
  'http://127.0.0.1:5000',
  'http://localhost:5000',
]);

const LEGACY_WS_URLS = new Set([
  'ws://127.0.0.1:8765',
  'ws://127.0.0.1:8765/ws',
  'ws://localhost:8765',
  'ws://localhost:8765/ws',
]);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const storageValue = (storage, key) => {
  try {
    return clean(storage?.getItem(key));
  } catch {
    return '';
  }
};

const replaceLegacy = (storage, key, value, legacyValues, replacement) => {
  if (!legacyValues.has(value)) return value;
  try {
    storage?.setItem(key, replacement);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
  return replacement;
};

const browserStorage = () => (typeof localStorage === 'undefined' ? null : localStorage);
const viteEnv = () => import.meta.env || {};

/**
 * Resolve the browser-facing IMC gateway. Explicit browser settings win over
 * build-time defaults so changing the connection dialog actually changes all
 * request paths after reload.
 */
export const resolveImcConfig = ({ storage = browserStorage(), env = viteEnv() } = {}) => {
  const storedApi = replaceLegacy(storage, 'imc_api_url', storageValue(storage, 'imc_api_url'), LEGACY_API_URLS, GATEWAY_API_URL);
  const storedWs = replaceLegacy(storage, 'imc_ws_url', storageValue(storage, 'imc_ws_url'), LEGACY_WS_URLS, GATEWAY_WS_URL);
  const envApi = clean(env.VITE_IMC_API_URL);
  const envWs = clean(env.VITE_IMC_WS_URL);
  const apiUrl = (storedApi || (LEGACY_API_URLS.has(envApi) ? GATEWAY_API_URL : envApi) || GATEWAY_API_URL).replace(/\/$/, '');
  const wsUrl = storedWs || (LEGACY_WS_URLS.has(envWs) ? GATEWAY_WS_URL : envWs) || GATEWAY_WS_URL;

  return {
    apiUrl,
    wsUrl,
    apiKey: storageValue(storage, 'imc_apikey') || storageValue(storage, 'oa_apikey'),
  };
};

export const IMC_DEFAULTS = Object.freeze({
  apiUrl: GATEWAY_API_URL,
  wsUrl: GATEWAY_WS_URL,
});

export const isLegacyImcApiUrl = (value) => LEGACY_API_URLS.has(clean(value));
export const isLegacyImcWsUrl = (value) => LEGACY_WS_URLS.has(clean(value));
