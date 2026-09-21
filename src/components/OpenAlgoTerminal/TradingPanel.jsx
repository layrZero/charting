import { useCallback, useEffect, useState } from 'react';
import { buildPlaceOrderPayload } from '../../services/orderPayload';

const initialOrder = { strategy: '', action: 'BUY', quantity: 1, product: 'MIS', pricetype: 'MARKET', price: '', triggerPrice: '' };

export default function TradingPanel({ client, active, strategy, onStrategyChange }) {
  const [mode, setMode] = useState(null);
  const [order, setOrder] = useState({ ...initialOrder, strategy });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshMode = useCallback(async () => {
    const nextMode = await client.analyzer();
    setMode(nextMode);
    return nextMode;
  }, [client]);

  useEffect(() => { void refreshMode().catch((error) => setStatus(error.message)); }, [refreshMode]);
  useEffect(() => { setOrder((current) => current.strategy === strategy ? current : { ...current, strategy }); }, [strategy]);

  const updateOrder = (patch) => setOrder((current) => ({ ...current, ...patch }));
  const updateStrategy = (value) => {
    updateOrder({ strategy: value });
    if (value.trim()) onStrategyChange?.(value.trim());
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const currentMode = await refreshMode();
      const payload = buildPlaceOrderPayload({ active, order, mode: currentMode });
      const result = await client.placeOrder(payload);
      const orderId = result.orderid || result.order_id;
      setStatus(orderId ? `Order submitted to IMC: ${orderId}` : 'Order submitted to IMC.');
    } catch (error) {
      setStatus(error.message || 'Unable to submit the IMC order.');
    } finally {
      setBusy(false);
    }
  };

  const needsLimitPrice = order.pricetype === 'LIMIT' || order.pricetype === 'SL';
  const needsTriggerPrice = order.pricetype === 'SL' || order.pricetype === 'SL-M';
  return <section className="side-card trading-card"><header><b>Order ticket</b><button type="button" onClick={() => void refreshMode().catch((error) => setStatus(error.message))}>↻</button></header><div className={`mode-pill ${mode?.mode === 'live' ? 'live' : 'analyzer'}`}>{mode?.mode || mode?.analyzer_mode || 'Mode unavailable'}</div><p className="instrument">{active.symbol} · {active.exchange}</p><form onSubmit={submit}><div className="form-row"><select aria-label="Action" value={order.action} onChange={(event) => updateOrder({ action: event.target.value })}><option>BUY</option><option>SELL</option></select><input aria-label="Quantity" min="1" required step="1" type="number" value={order.quantity} onChange={(event) => updateOrder({ quantity: event.target.value })} /></div><div className="form-row"><select aria-label="Product" value={order.product} onChange={(event) => updateOrder({ product: event.target.value })}><option>MIS</option><option>CNC</option><option>NRML</option></select><select aria-label="Price type" value={order.pricetype} onChange={(event) => updateOrder({ pricetype: event.target.value, price: '', triggerPrice: '' })}><option>MARKET</option><option>LIMIT</option><option>SL</option><option>SL-M</option></select></div>{needsLimitPrice && <input aria-label="Limit price" min="0.000001" placeholder="Limit price" required step="any" type="number" value={order.price} onChange={(event) => updateOrder({ price: event.target.value })} />}{needsTriggerPrice && <input aria-label="Trigger price" min="0.000001" placeholder="Trigger price" required step="any" type="number" value={order.triggerPrice} onChange={(event) => updateOrder({ triggerPrice: event.target.value })} />}<label className="strategy-field">Strategy<input aria-label="Strategy" required placeholder="e.g. RPOWER-5m-manual" value={order.strategy} onChange={(event) => updateStrategy(event.target.value)} /></label><button className={`place-order ${order.action === 'BUY' ? 'buy' : 'sell'}`} disabled={busy || !mode}>{busy ? 'Submitting…' : `${order.action} ${active.symbol}`}</button></form>{status && <p className="trade-status">{status}</p>}<p className="safety-note">A strategy groups IMC order exposure. The current IMC analyzer/live mode is refreshed immediately before this one-click submission.</p></section>;
}
