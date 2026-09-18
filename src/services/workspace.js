const KEY = 'layr0_openalgo_workspace_v2';
export const defaultWorkspace = { version: 2, active: { symbol: 'NIFTY', exchange: 'NSE_INDEX', interval: '5m' }, theme: 'dark', panels: { optionChain: true, trading: true }, forecast: { mode: 'rolling-10' }, updatedAt: null };
export const loadWorkspace = () => { try { return { ...defaultWorkspace, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaultWorkspace; } };
export const saveWorkspace = (workspace) => localStorage.setItem(KEY, JSON.stringify({ ...workspace, version: 2, updatedAt: new Date().toISOString() }));
