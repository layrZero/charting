import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeExpiryList, normalizeOptionChain, resolveOptionUnderlying } from '../../services/optionDomain.js';

const KNOWN_UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'];
const errorText = (error) => error?.message || 'Unable to load option-chain data.';

export default function OptionChainPanel({ client, active, onSelect }) {
  const resolved = useMemo(() => resolveOptionUnderlying(active), [active]);
  const [underlying, setUnderlying] = useState(resolved.symbol);
  const [derivativeExchange, setDerivativeExchange] = useState(resolved.exchange);
  const [expiry, setExpiry] = useState(resolved.expiry);
  const [expiries, setExpiries] = useState([]); const [chain, setChain] = useState(null);
  const [status, setStatus] = useState('idle'); const [error, setError] = useState(''); const [updatedAt, setUpdatedAt] = useState(null); const [refreshKey, setRefreshKey] = useState(0);
  const generation = useRef(0);
  const underlyings = useMemo(() => [...new Set([resolved.symbol, ...KNOWN_UNDERLYINGS].filter(Boolean))], [resolved.symbol]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUnderlying(resolved.symbol); setDerivativeExchange(resolved.exchange); setExpiry(resolved.expiry); }, [resolved.symbol, resolved.exchange, resolved.expiry]);

  useEffect(() => {
    const controller = new AbortController(); const requestId = ++generation.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading-expiries'); setError(''); setChain(null); setExpiries([]);
    client.expiry(underlying, derivativeExchange, 'options', { signal: controller.signal }).then((payload) => {
      if (controller.signal.aborted || requestId !== generation.current) return;
      const values = normalizeExpiryList(payload); setExpiries(values);
      setExpiry((current) => values.some((item) => item.value === current) ? current : (values[0]?.value || ''));
      setStatus(values.length ? 'ready' : 'empty-expiries'); if (!values.length) setError(`No option expiries found for ${underlying}.`);
    }).catch((caught) => { if (caught?.name !== 'AbortError' && requestId === generation.current) { setStatus('error'); setError(errorText(caught)); } });
    return () => controller.abort();
  }, [client, underlying, derivativeExchange, refreshKey]);

  useEffect(() => {
    if (!expiry) return undefined;
    const controller = new AbortController(); const requestId = ++generation.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading-chain'); setError(''); setChain(null);
    const refresh = () => client.optionChain(underlying, derivativeExchange, expiry, 15, { signal: controller.signal }).then((payload) => {
      if (controller.signal.aborted || requestId !== generation.current) return;
      const normalized = normalizeOptionChain(payload, derivativeExchange); setChain(normalized); setUpdatedAt(new Date());
      setStatus(normalized.rows.length ? 'ready' : 'empty-chain'); if (!normalized.rows.length) setError(`No option strikes returned for ${underlying} ${normalized.expiry}.`);
    }).catch((caught) => { if (caught?.name !== 'AbortError' && requestId === generation.current) { setStatus('error'); setError(errorText(caught)); } });
    void refresh(); const timer = setInterval(refresh, 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [client, underlying, derivativeExchange, expiry, refreshKey]);

  const retry = () => setRefreshKey((value) => value + 1);
  const loading = status === 'loading-expiries' || status === 'loading-chain';
  const selectedExpiry = expiries.find((item) => item.value === expiry);
  return <section className="side-card option-chain">
    <header><b>Option chain</b><button onClick={retry} title="Refresh option chain" aria-label="Refresh option chain">↻</button></header>
    <div className="form-row"><select value={underlying} onChange={(event) => { const value = event.target.value; setUnderlying(value); setDerivativeExchange(['SENSEX', 'BANKEX'].includes(value) ? 'BFO' : 'NFO'); }} aria-label="Option underlying">{underlyings.map((item) => <option key={item}>{item}</option>)}</select><select value={expiry} onChange={(event) => setExpiry(event.target.value)} disabled={!expiries.length} aria-label="Option expiry">{expiries.map((item) => <option key={item.value} value={item.value}>{item.display}</option>)}</select></div>
    {loading && <p className="chain-status">Loading {status === 'loading-expiries' ? 'expiries' : 'option chain'}…</p>}
    {error && <p className="error">{error}</p>}
    {chain && <div className="chain-spot">Spot {chain.spot.toFixed(2)} · ATM {chain.atmStrike || '—'} · {selectedExpiry?.display || chain.expiryDisplay}</div>}
    {updatedAt && <div className="chain-updated">Updated {updatedAt.toLocaleTimeString()}</div>}
    <div className="chain-table"><div className="chain-head"><span>CE</span><span>Strike</span><span>PE</span></div>{chain?.rows.map((row) => <div className="chain-row" key={row.strike}><button disabled={!row.ce?.symbol} title={row.ce ? `${row.ce.label || 'CE'} · OI ${row.ce.oi}` : 'Call unavailable'} onClick={() => row.ce && onSelect({ ...row.ce, exchange: row.ce.exchange, underlying, expiry })}><span>{row.ce?.ltp ?? '—'}</span><small>{row.ce?.label || ''} {row.ce ? `OI ${row.ce.oi}` : ''}</small></button><b className={row.strike === chain.atmStrike ? 'atm' : ''}>{row.strike}</b><button disabled={!row.pe?.symbol} title={row.pe ? `${row.pe.label || 'PE'} · OI ${row.pe.oi}` : 'Put unavailable'} onClick={() => row.pe && onSelect({ ...row.pe, exchange: row.pe.exchange, underlying, expiry })}><span>{row.pe?.ltp ?? '—'}</span><small>{row.pe?.label || ''} {row.pe ? `OI ${row.pe.oi}` : ''}</small></button></div>)}</div>
  </section>;
}
