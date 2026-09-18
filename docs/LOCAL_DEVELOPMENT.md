# Local development and startup

## Prerequisites

Install Node.js 20+, npm, Git, `uv` 0.5+, and Python 3.10+ available through
`uv`. The application also needs a reachable India Market Connector instance
and a valid API key. No IMC frontend source is required in this repository.

## Process topology

```text
Browser :5001 ── history/options/trading ──> IMC REST/WebSocket
    │
    └── completed OHLCV only ──> Kronos API :8001 ──> Kronos-small
```

The browser sends no IMC credentials to Kronos. The Kronos service is local-only
on this branch. With the current IMC Docker development stack, the browser
must use the published gateway at `http://127.0.0.1:8080` and
`ws://127.0.0.1:8080/ws`; IMC's `5000` and `8765` ports are internal to the
Docker network.

## First startup

From the repository root on Windows:

```bat
npm install
copy .env.example .env.local
start.bat
```

From Bash, Git Bash, Linux, or macOS:

```bash
npm install
cp .env.example .env.local
bash start.sh
```

Both launchers validate `uv`, Node, npm, and Git; run `uv sync`; bootstrap the
pinned Kronos commit; start Kronos on `127.0.0.1:8001`; and start Vite plus the
signal receiver on port `5001`.

## Manual startup

Kronos terminal:

```bash
uv sync --project services/kronos
uv run --project services/kronos python services/kronos/bootstrap.py
uv run --project services/kronos python services/kronos/app.py
```

Charts terminal:

```bash
npm run dev
```

Use `http://127.0.0.1:8001/health` to check Kronos,
`http://localhost:5001` to open Charts, and
`http://127.0.0.1:8080/` to check the IMC gateway. Enter the following IMC
settings in the application for the Docker development stack:

```text
REST URL:      http://127.0.0.1:8080
WebSocket URL: ws://127.0.0.1:8080/ws
```

The connection resolver gives browser-saved settings precedence over Vite
environment variables. It migrates only the old local `5000`/`8765` defaults;
custom remote endpoints are preserved.

## Development commands

```bash
uv run --project services/kronos python -m unittest discover -s services/kronos/tests -v
npm test
npm run lint
npm run build
```

`uv.lock` is the Python dependency source of truth. Do not use `pip install`
for this service. npm remains the dependency manager for the Vite application.

## Shutdown and troubleshooting

Press `Ctrl+C` in Bash. On Windows, close the frontend terminal and the
separate `Layr0 Kronos` window. If startup fails, check the following:

- `uv` missing: install `uv` and reopen the terminal.
- Bootstrap failure: verify GitHub access and rerun the bootstrap command.
- Port conflict: stop the process using 5001 or 8001.
- Forecast unavailable: confirm the Kronos process is healthy on port 8001.
- No chart data: confirm IMC is running, use the published `8080` gateway
  rather than container-internal ports `5000`/`8765`, and inspect the displayed
  IMC error code. `INVALID_API_KEY` or `MISSING_API_KEY` is an authentication
  response; `IMC_NETWORK_OR_CORS_ERROR` means the browser could not reach the
  configured endpoint or the response was blocked by browser policy.
- Slow first forecast: the model is being downloaded and cached locally.
