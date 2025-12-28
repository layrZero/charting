export default {
    mqttBroker: 'tcp://localhost:1883', // Default to WebSocket broker for easier local testing, change to tcp://localhost:1883 if needed
    serverPort: 3001,
    topics: ['signals/#', 'trading/#'], // Subscribe to signal related topics. Use '#' for everything.
    logPath: './mqtt_signals', // Directory to store signal logs
    // webSocketPort: 8080 // Optional: If we want to forward signals to frontend via WS later
    // Chart specific configuration used by the frontend dev server/proxy
    chart: {
        // host/ip address for the chart backend (used by vite proxy targets)
        serverHost: 'upright-dog-rapidly.ngrok-free.app',
        // backend API port the chart frontend should proxy API requests to
        serverPort: 5000,
        // optional websocket port the chart frontend should proxy to
        webSocketPort: 8765,
        // API key used by the chart/backend API requests. Read from environment variables:
        // `OPENALGO_API_KEY` or `API_KEY`. Replace the placeholder only for local testing.
        apiKey: process.env.OPENALGO_API_KEY || process.env.API_KEY || 'e486c10c6d3bbf0bd8fd2f8663ea406b0ed53d46090202b5910395aa44f45958',
    }
};
