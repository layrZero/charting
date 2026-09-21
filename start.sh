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

TIMESFM_ACTION="$(node scripts/kronos-preflight.mjs)"
case "$TIMESFM_ACTION" in
  START)
    echo "TimesFM port is free; starting TimesFM on 127.0.0.1:8001."
    uv run --project services/kronos python services/kronos/app.py &
    TIMESFM_PID=$!
    TIMESFM_OWNED=1
    ;;
  REUSE)
    echo "TimesFM is already healthy on 127.0.0.1:8001; reusing it."
    TIMESFM_OWNED=0
    ;;
  *)
    echo "TimesFM preflight failed." >&2
    exit 1
    ;;
esac

cleanup() {
  trap - INT TERM EXIT
  [[ "${TIMESFM_OWNED:-0}" == "1" && -n "${TIMESFM_PID:-}" ]] && kill "$TIMESFM_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

npm run dev &
FRONTEND_PID=$!

echo "TimesFM: http://127.0.0.1:8001"
echo "Charts: http://localhost:5001"
wait "${TIMESFM_PID:-$FRONTEND_PID}" "$FRONTEND_PID"
