const supportedPriceTypes = new Set(['MARKET', 'LIMIT', 'SL', 'SL-M']);

const requiredText = (value, label) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required.`);
  return text;
};

const positiveNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
};

const currentModeSnapshot = (mode) => ({
  expected_mode: requiredText(mode?.mode ?? mode?.analyzer_mode, 'IMC mode'),
  expected_balance_type: requiredText(mode?.balance_type, 'IMC balance type'),
  expected_mode_version: positiveNumber(mode?.mode_version ?? mode?.version, 'IMC mode version'),
});

export const createBrowserRequestId = () => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('Secure browser request IDs are unavailable.');
  return globalThis.crypto.randomUUID();
};

/** Build the exact IMC placeorder body, excluding the API key supplied by ImcClient. */
export const buildPlaceOrderPayload = ({ active, order, mode, requestId = createBrowserRequestId() }) => {
  const pricetype = requiredText(order?.pricetype, 'Price type').toUpperCase();
  if (!supportedPriceTypes.has(pricetype)) throw new Error('Unsupported price type.');
  const payload = {
    strategy: requiredText(order?.strategy, 'Strategy'),
    symbol: requiredText(active?.symbol, 'Symbol'),
    exchange: requiredText(active?.exchange, 'Exchange'),
    action: requiredText(order?.action, 'Action').toUpperCase(),
    product: requiredText(order?.product, 'Product').toUpperCase(),
    pricetype,
    quantity: positiveNumber(order?.quantity, 'Quantity'),
    ...currentModeSnapshot(mode),
    request_id: requiredText(requestId, 'Request ID'),
  };
  if (pricetype === 'LIMIT' || pricetype === 'SL') payload.price = positiveNumber(order?.price, 'Limit price');
  if (pricetype === 'SL' || pricetype === 'SL-M') payload.trigger_price = positiveNumber(order?.triggerPrice, 'Trigger price');
  return payload;
};
