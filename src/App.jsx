import { useEffect, useMemo, useState } from 'react';
import { Settings, PanelRightOpen, PanelRightClose } from 'lucide-react';
import ChartTerminal from './components/OpenAlgoTerminal/ChartTerminal';
import OptionChainPanel from './components/OpenAlgoTerminal/OptionChainPanel';
import TradingPanel from './components/OpenAlgoTerminal/TradingPanel';
import PortfolioPanel from './components/OpenAlgoTerminal/PortfolioPanel';
import { ImcClient, imcConfig } from './services/imcClient';
import { loadWorkspace, saveWorkspace } from './services/workspace';
import './App.css';

export default function App() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [mobilePanel, setMobilePanel] = useState('chart');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const client = useMemo(() => new ImcClient(), []);
  const updateActive = (next) => setWorkspace((previous) => ({ ...previous, active: { ...previous.active, ...next } }));
  useEffect(() => { saveWorkspace(workspace); }, [workspace]);
  return <main className="terminal-shell">
    <header className="terminal-header"><div><strong>Layr0 Charts</strong><span>Layer Zero chart engine · IMC terminal</span></div><div className="header-actions"><button onClick={() => setWorkspace((w) => ({ ...w, panels: { ...w.panels, optionChain: !w.panels.optionChain } }))} aria-label="Toggle option chain">{workspace.panels.optionChain ? <PanelRightClose /> : <PanelRightOpen />}</button><button onClick={() => setSettingsOpen(true)} aria-label="Connection settings"><Settings /></button></div></header>
    <nav className="mobile-tabs" aria-label="Terminal panels">{['chart', 'options', 'trade', 'portfolio'].map((panel) => <button key={panel} className={mobilePanel === panel ? 'active' : ''} onClick={() => setMobilePanel(panel)}>{panel}</button>)}</nav>
    <section className={`terminal-grid panel-${mobilePanel}`}><article className="chart-panel"><ChartTerminal client={client} active={workspace.active} onActiveChange={updateActive} theme={workspace.theme} forecastMode={workspace.forecast?.mode || 'rolling-10'} /></article>{workspace.panels.optionChain && <aside className="options-panel"><OptionChainPanel client={client} active={workspace.active} onSelect={(contract) => updateActive({ symbol: contract.symbol, exchange: contract.exchange || 'NFO' })} /></aside>}<aside className="trading-panel"><TradingPanel client={client} active={workspace.active} /></aside><aside className="portfolio-panel"><PortfolioPanel client={client} /></aside></section>
    {settingsOpen && <ConnectionSettings forecastMode={workspace.forecast?.mode || 'rolling-10'} onForecastModeChange={(mode) => setWorkspace((w) => ({ ...w, forecast: { ...w.forecast, mode } }))} onClose={() => { setSettingsOpen(false); window.location.reload(); }} />}
  </main>;
}

function ConnectionSettings({ onClose, forecastMode, onForecastModeChange }) {
  const config = imcConfig();
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [wsUrl, setWsUrl] = useState(config.wsUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const save = (event) => { event.preventDefault(); localStorage.setItem('imc_api_url', apiUrl); localStorage.setItem('imc_ws_url', wsUrl); localStorage.setItem('imc_apikey', apiKey); onClose(); };
  return <div className="modal-backdrop"><form className="connection-dialog" onSubmit={save}><h2>IMC connection</h2><label>REST URL<input required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></label><label>WebSocket URL<input required value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} /></label><label>API key<input required type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label><label>Forecast display<select value={forecastMode} onChange={(e) => onForecastModeChange(e.target.value)}><option value="rolling-10">Only the next 10 predicted candles</option><option value="retain-fulfilled-overlays">Keep fulfilled forecast outlines</option></select></label><p>Credentials stay in this browser and are sent only to the configured IMC server. Kronos receives only normalized market bars.</p><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save & reload</button></footer></form></div>;
}
