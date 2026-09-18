import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx'
import { registerBuiltinIndicators } from '@layr0/chart-engine/indicators'

// The indicator tier is intentionally opt-in. Register it before the React
// tree creates any chart widgets so every picker sees the same registry.
registerBuiltinIndicators()

// Apply theme immediately to prevent flash of default theme
// This runs synchronously BEFORE React renders anything
const savedTheme = localStorage.getItem('tv_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
