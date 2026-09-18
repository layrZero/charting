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

for /f "delims=" %%A in ('node scripts\kronos-preflight.mjs') do set "KRONOS_ACTION=%%A"
if errorlevel 2 exit /b 1

if /i "%KRONOS_ACTION%"=="START" (
  echo Kronos port is free; starting Kronos in a new window...
  start "Layr0 Kronos" /D "%~dp0" cmd /k uv run --project services/kronos python services/kronos/app.py
) else (
  echo Kronos is already healthy on 127.0.0.1:8001; reusing it.
)
echo Starting Charts frontend and signal receiver in this window...
echo Kronos: http://127.0.0.1:8001
echo Charts: http://localhost:5001
npm run dev
