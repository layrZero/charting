export default {
    // MQTT broker URL. Prefer setting `MQTT_BROKER` in the environment for remote hosts.
    // Examples: tcp://host:1883  or ws://host:9001 (for MQTT over WebSockets)
    mqttBroker: process.env.MQTT_BROKER || 'tcp://localhost:1883',
    serverPort: 3001,
    topics: ['signals/#', 'trading/#'], // Subscribe to signal related topics. Use '#' for everything.
    logPath: './mqtt_signals', // Directory to store signal logs
    // webSocketPort: 8080 // Optional: If we want to forward signals to frontend via WS later
    // Chart specific configuration used by the frontend dev server/proxy
    chart: {
        // host/ip address for the chart backend (used by vite proxy targets).
        // Prefer setting `OPENALGO_SERVER_HOST` and `OPENALGO_SERVER_PORT` in env.
        serverHost: process.env.OPENALGO_SERVER_HOST || 'upright-dog-rapidly.ngrok-free.app',
        // backend API port the chart frontend should proxy API requests to
        // For ngrok URLs, leave empty (uses standard HTTPS port 443)
        serverPort: process.env.OPENALGO_SERVER_PORT || '',
        // optional websocket port the chart frontend should proxy to
        // For ngrok URLs, leave empty (uses standard HTTPS port 443)
        webSocketPort: process.env.OPENALGO_WS_PORT || '',
        // API key used by the chart/backend API requests. Always prefer environment
        // variables (`OPENALGO_API_KEY` or `API_KEY`). Do NOT commit real keys.
        apiKey: process.env.OPENALGO_API_KEY || process.env.API_KEY || '8d4da51d2fd0f6bdeeba93868837e6f1859afbf0b90fedfa50a3d6cd745c21c6',
    }
};
