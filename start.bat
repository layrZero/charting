@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where uv >nul 2>&1 || (echo Missing required command: uv & exit /b 1)
where node >nul 2>&1 || (echo Missing required command: node & exit /b 1)
where npm >nul 2>&1 || (echo Missing required command: npm & exit /b 1)
where git >nul 2>&1 || (echo Missing required command: git & exit /b 1)

if not exist .env.local copy .env.example .env.local
if not exist node_modules npm install

uv sync --project services/kronos || exit /b 1
uv run --project services/kronos python services/kronos/bootstrap.py || exit /b 1

echo Starting Kronos forecast service in a new window...
start "Layr0 Kronos" /D "%~dp0" cmd /k uv run --project services/kronos python services/kronos/app.py
echo Starting Charts frontend and signal receiver in this window...
echo Kronos: http://127.0.0.1:8001
echo Charts: http://localhost:5001
npm run dev
