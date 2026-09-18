#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_command uv
require_command node
require_command npm
require_command git

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example."
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

uv sync --project services/kronos
uv run --project services/kronos python services/kronos/bootstrap.py

KRONOS_ACTION="$(node scripts/kronos-preflight.mjs)"
case "$KRONOS_ACTION" in
  START)
    echo "Kronos port is free; starting Kronos on 127.0.0.1:8001."
    uv run --project services/kronos python services/kronos/app.py &
    KRONOS_PID=$!
    KRONOS_OWNED=1
    ;;
  REUSE)
    echo "Kronos is already healthy on 127.0.0.1:8001; reusing it."
    KRONOS_OWNED=0
    ;;
  *)
    echo "Kronos preflight failed." >&2
    exit 1
    ;;
esac

cleanup() {
  trap - INT TERM EXIT
  [[ "${KRONOS_OWNED:-0}" == "1" && -n "${KRONOS_PID:-}" ]] && kill "$KRONOS_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

npm run dev &
FRONTEND_PID=$!

echo "Kronos: http://127.0.0.1:8001"
echo "Charts: http://localhost:5001"
wait "$KRONOS_PID" "$FRONTEND_PID"
