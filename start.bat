@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where uv >nul 2>&1 || (echo Missing required command: uv & exit /b 1)
where node >nul 2>&1 || (echo Missing required command: node & exit /b 1)
where npm >nul 2>&1 || (echo Missing required command: npm & exit /b 1)
where git >nul 2>&1 || (echo Missing required command: git & exit /b 1)

if not exist .env.local copy .env.example .env.local
if not exist node_modules npm install

uv sync --project services/timesfm || exit /b 1

for /f "delims=" %%A in ('node scripts\timesfm-preflight.mjs') do set "TIMESFM_ACTION=%%A"
if errorlevel 2 exit /b 1

if /i "%TIMESFM_ACTION%"=="START" (
  echo TimesFM port is free; starting TimesFM in a new window...
  start "Layr0 TimesFM" /D "%~dp0" cmd /k uv run --project services/timesfm python services/timesfm/app.py
) else (
  echo TimesFM is already healthy on 127.0.0.1:8001; reusing it.
)
echo Starting Charts frontend and signal receiver in this window...
echo TimesFM: http://127.0.0.1:8001
echo Charts: http://localhost:5001
npm run dev
