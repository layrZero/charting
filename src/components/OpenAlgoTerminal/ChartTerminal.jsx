import { useEffect, useRef, useState } from 'react';
import { createWidget } from '@layr0/chart-engine/widget';
import { ImcMarketDataFeed } from '../../services/imcFeeds';
import { completedBars, intervalSeconds, loadForecastCalendar, nextForecastTimes } from '../../services/forecastCalendar';
import { requestKronosForecast } from '../../services/kronosForecast';

const intervals = ['1m', '5m', '15m', '1h', '1d', '1w'];
const settlementDelayMs = 5_000;
const futureStyle = { title: 'Kronos forecast', upColor: 'rgba(139, 92, 246, 0.72)', downColor: 'rgba(245, 158, 11, 0.72)', borderUpColor: '#a78bfa', borderDownColor: '#fbbf24', wickUpColor: '#a78bfa', wickDownColor: '#fbbf24', priceLineVisible: false, lastValueVisible: false };
const fulfilledStyle = { title: 'Kronos fulfilled forecast', upColor: '#a78bfa', downColor: '#fbbf24', borderUpColor: '#a78bfa', borderDownColor: '#fbbf24', wickUpColor: '#a78bfa', wickDownColor: '#fbbf24', bodyVisible: false, priceLineVisible: false, lastValueVisible: false };

export default function ChartTerminal({ client, active, onActiveChange, theme, forecastMode }) {
  const host = useRef(null); const widget = useRef(null); const mode = useRef(forecastMode); const abort = useRef(null); const timer = useRef(null); const forecastByTime = useRef(new Map()); const fulfilledByTime = useRef(new Map()); const generation = useRef(0);
  const initial = useRef({ symbol: active.symbol, exchange: active.exchange, interval: active.interval, theme }); const callbacks = useRef({ client, onActiveChange });
  const [error, setError] = useState(''); const [forecast, setForecast] = useState({ status: 'Waiting for broker history', generatedAt: null, count: 0 });

  useEffect(() => { mode.current = forecastMode; }, [forecastMode]);
  useEffect(() => { callbacks.current = { client, onActiveChange }; }, [client, onActiveChange]);
  // The widget is deliberately mounted once; later active-symbol changes use its public API below.
  useEffect(() => { try {
    const feed = new ImcMarketDataFeed(callbacks.current.client);
    const createdWidget = createWidget(host.current, { feed, symbol: initial.current.symbol, exchange: initial.current.exchange, interval: initial.current.interval, intervals, theme: initial.current.theme, persist: false, mobile: 'auto', lookbackBars: 400, symbolSearch: async (query) => { const result = await callbacks.current.client.search(query); return (result.data || result.symbols || []).map((item) => ({ symbol: item.symbol, exchange: item.exchange })); }, onOrder: () => document.querySelector('.trading-panel')?.scrollIntoView({ behavior: 'smooth' }) });
    widget.current = createdWidget;
    const futureSeries = createdWidget.chart.addSeries('candlestick', { style: futureStyle });
    const fulfilledSeries = createdWidget.chart.addSeries('candlestick', { style: fulfilledStyle });
    const clearForecast = () => { futureSeries.setData([]); fulfilledSeries.setData([]); forecastByTime.current.clear(); fulfilledByTime.current.clear(); };
    const scheduleRefresh = (nextTime) => { clearTimeout(timer.current); const delay = Math.max(settlementDelayMs, nextTime * 1000 + settlementDelayMs - Date.now()); timer.current = setTimeout(() => { if (!createdWidget.isDestroyed) void createdWidget.reload(); }, delay); };
    const runForecast = async () => {
      const requestId = ++generation.current;
      abort.current?.abort(); abort.current = new AbortController();
      const bars = completedBars(createdWidget.series.getData(), createdWidget.interval());
      if (bars.length === 0) { clearForecast(); setForecast({ status: 'Waiting for a completed broker candle', generatedAt: null, count: 0 }); return; }
      for (const actual of bars) { const predicted = forecastByTime.current.get(actual.time); if (predicted) fulfilledByTime.current.set(actual.time, predicted); }
      if (mode.current === 'rolling-10') fulfilledByTime.current.clear();
      setForecast({ status: 'Forecasting ten candles…', generatedAt: null, count: 0 }); setError('');
      try {
        const history = bars.slice(-512).map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }));
        const calendar = await loadForecastCalendar(callbacks.current.client, history.at(-1).time, createdWidget.exchange());
        const futureTimestamps = nextForecastTimes({ lastTime: history.at(-1).time, interval: createdWidget.interval(), ...calendar });
        const result = await requestKronosForecast({ symbol: createdWidget.symbol(), exchange: createdWidget.exchange(), interval: createdWidget.interval(), bars: history, futureTimestamps, signal: abort.current.signal });
        if (requestId !== generation.current || createdWidget.isDestroyed) return;
        const candles = result.candles.map((candle) => ({ time: Number(candle.time), open: Number(candle.open), high: Number(candle.high), low: Number(candle.low), close: Number(candle.close), volume: Number(candle.volume || 0) }));
        forecastByTime.current = new Map(candles.map((candle) => [candle.time, candle])); futureSeries.setData(candles);
        fulfilledSeries.setData(mode.current === 'retain-fulfilled-overlays' ? [...fulfilledByTime.current.values()] : []);
        setForecast({ status: 'Kronos forecast — not trading advice', generatedAt: result.generated_at || new Date().toISOString(), count: candles.length }); scheduleRefresh(futureTimestamps[0] + intervalSeconds(createdWidget.interval()));
      } catch (caught) {
        if (caught.name === 'AbortError' || requestId !== generation.current) return;
        futureSeries.setData([]); setError(caught.message || 'Kronos forecast unavailable.'); setForecast({ status: 'Forecast unavailable', generatedAt: null, count: 0 });
      }
    };
    const offSymbol = createdWidget.on('symbol', ({ symbol, exchange }) => { clearForecast(); callbacks.current.onActiveChange({ symbol, exchange }); });
    const offInterval = createdWidget.on('interval', ({ interval }) => { clearForecast(); callbacks.current.onActiveChange({ interval }); });
    const offData = createdWidget.on('data', () => { void runForecast(); });
    return () => { abort.current?.abort(); clearTimeout(timer.current); offSymbol(); offInterval(); offData(); futureSeries.remove(); fulfilledSeries.remove(); createdWidget.destroy(); if (widget.current === createdWidget) widget.current = null; };
  } catch (caught) { setTimeout(() => setError(caught.message || 'Unable to start the chart.'), 0); } }, []);
  useEffect(() => { if (widget.current && (widget.current.symbol() !== active.symbol || widget.current.exchange() !== active.exchange)) widget.current.setSymbol(active.symbol, active.exchange); }, [active.symbol, active.exchange]);
  useEffect(() => { if (widget.current && widget.current.interval() !== active.interval) widget.current.setInterval(active.interval); }, [active.interval]);
  useEffect(() => { if (widget.current && mode.current === 'rolling-10') fulfilledByTime.current.clear(); }, [forecastMode]);
  return <div className="chart-terminal"><div className="chart-context"><b>{active.symbol}</b><span>{active.exchange}</span><select value={active.interval} onChange={(e) => onActiveChange({ interval: e.target.value })}>{intervals.map((item) => <option key={item}>{item}</option>)}</select></div><div className="forecast-status" role="status"><b>{forecast.status}</b>{forecast.count > 0 && <span>{forecast.count} forward candles</span>}{forecast.generatedAt && <time dateTime={forecast.generatedAt}>Updated {new Date(forecast.generatedAt).toLocaleTimeString()}</time>}</div>{error && <p className="error">{error}</p>}<div ref={host} className="openalgo-host" /></div>;
}
