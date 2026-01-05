import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import signalConfig from './signal-config.js'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Use relative paths for static deployment (GitHub Pages)
  plugins: [react()],
  server: {
    port: 5001,
    proxy: (() => {
      const serverProtocol = process.env.OPENALGO_SERVER_PROTOCOL || 'https'; // Use HTTPS for ngrok by default
      const serverHost = process.env.OPENALGO_SERVER_HOST || signalConfig.chart?.serverHost || '127.0.0.1';
      const serverPort = process.env.OPENALGO_SERVER_PORT || signalConfig.chart?.serverPort;

      // Build API target: omit default ports for TLS/standard HTTP when appropriate
      let apiTarget = `${serverProtocol}://${serverHost}`;
      if (serverPort && !(serverProtocol === 'https' && String(serverPort) === '443') && !(serverProtocol === 'http' && String(serverPort) === '80')) {
        apiTarget += `:${serverPort}`;
      }

      const wsProtocol = serverProtocol === 'https' ? 'wss' : 'ws';
      const wsPort = process.env.OPENALGO_WS_PORT || signalConfig.chart?.webSocketPort;
      let wsTarget = `${wsProtocol}://${serverHost}`;
      if (wsPort && !(wsProtocol === 'wss' && String(wsPort) === '443') && !(wsProtocol === 'ws' && String(wsPort) === '80')) {
        wsTarget += `:${wsPort}`;
      }

      const proxyMap = {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: serverProtocol === 'https',
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          secure: serverProtocol === 'https',
        },
        '/npl-time': {
          target: 'https://www.nplindia.in',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/npl-time/, '/cgi-bin/ntp_client'),
          secure: true,
        },
      };

      return proxyMap;
    })(),
  }
})
