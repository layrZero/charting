import { useEffect, useMemo, useState } from 'react';
import { Settings, PanelRightOpen, PanelRightClose } from 'lucide-react';
import ChartTerminal from './components/OpenAlgoTerminal/ChartTerminal';
import OptionChainPanel from './components/OpenAlgoTerminal/OptionChainPanel';
import TradingPanel from './components/OpenAlgoTerminal/TradingPanel';
import PortfolioPanel from './components/OpenAlgoTerminal/PortfolioPanel';
import { ImcClient } from './services/imcClient';
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
    <header className="terminal-header"><div><strong>Layr0 Charts</strong><span>OpenAlgo Charts 2.2 · IMC terminal</span></div><div className="header-actions"><button onClick={() => setWorkspace((w) => ({ ...w, panels: { ...w.panels, optionChain: !w.panels.optionChain } }))} aria-label="Toggle option chain">{workspace.panels.optionChain ? <PanelRightClose /> : <PanelRightOpen />}</button><button onClick={() => setSettingsOpen(true)} aria-label="Connection settings"><Settings /></button></div></header>
    <nav className="mobile-tabs" aria-label="Terminal panels">{['chart', 'options', 'trade', 'portfolio'].map((panel) => <button key={panel} className={mobilePanel === panel ? 'active' : ''} onClick={() => setMobilePanel(panel)}>{panel}</button>)}</nav>
    <section className={`terminal-grid panel-${mobilePanel}`}><article className="chart-panel"><ChartTerminal client={client} active={workspace.active} onActiveChange={updateActive} theme={workspace.theme} /></article>{workspace.panels.optionChain && <aside className="options-panel"><OptionChainPanel client={client} active={workspace.active} onSelect={(contract) => updateActive({ symbol: contract.symbol, exchange: contract.exchange || 'NFO' })} /></aside>}<aside className="trading-panel"><TradingPanel client={client} active={workspace.active} /></aside><aside className="portfolio-panel"><PortfolioPanel client={client} /></aside></section>
    {settingsOpen && <ConnectionSettings onClose={() => { setSettingsOpen(false); window.location.reload(); }} />}
  </main>;
}

function ConnectionSettings({ onClose }) {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('imc_api_url') || import.meta.env.VITE_IMC_API_URL || 'http://127.0.0.1:5000');
  const [wsUrl, setWsUrl] = useState(localStorage.getItem('imc_ws_url') || import.meta.env.VITE_IMC_WS_URL || 'ws://127.0.0.1:8765/ws');
  const [apiKey, setApiKey] = useState(localStorage.getItem('imc_apikey') || '');
  const save = (event) => { event.preventDefault(); localStorage.setItem('imc_api_url', apiUrl); localStorage.setItem('imc_ws_url', wsUrl); localStorage.setItem('imc_apikey', apiKey); onClose(); };
  return <div className="modal-backdrop"><form className="connection-dialog" onSubmit={save}><h2>IMC connection</h2><label>REST URL<input required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} /></label><label>WebSocket URL<input required value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} /></label><label>API key<input required type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label><p>Credentials stay in this browser and are sent only to the configured IMC server.</p><footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save & reload</button></footer></form></div>;
}
