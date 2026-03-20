#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${HOST:-127.0.0.1}"
BACK_PORT="${BACK_PORT:-8001}"
FRONT_PORT="${FRONT_PORT:-5173}"
FRONT_MODE="${FRONT_MODE:-dev}"
LOG_DIR="$ROOT/.runlogs"

mkdir -p "$LOG_DIR"

if [ ! -x "$ROOT/backend/.venv/bin/python" ]; then
  echo "ERRO: backend/.venv não encontrado. Rode: ./run_all.sh setup-back"
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Instalando frontend/node_modules..."
  (cd "$ROOT/frontend" && npm install)
fi

"$ROOT/tools/kill_ports.sh" all >/dev/null 2>&1 || true

echo "Subindo backend em background..."
(
  cd "$ROOT/backend"
  nohup ./.venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$BACK_PORT" \
    > "$LOG_DIR/back.log" 2>&1 &
  echo $! > "$LOG_DIR/back.pid"
)

echo "Subindo frontend em background..."
(
  cd "$ROOT/frontend"
  if [ "$FRONT_MODE" = "preview" ]; then
    npm run build >/dev/null
    nohup npm run preview -- --host "$HOST" --port "$FRONT_PORT" \
      > "$LOG_DIR/front.log" 2>&1 &
  else
    nohup npm run dev -- --host "$HOST" --port "$FRONT_PORT" \
      > "$LOG_DIR/front.log" 2>&1 &
  fi
  echo $! > "$LOG_DIR/front.pid"
)

sleep 1

echo "BACKEND:  http://$HOST:$BACK_PORT/health"
echo "FRONTEND: http://$HOST:$FRONT_PORT/#login (mode=$FRONT_MODE)"

if command -v lsof >/dev/null 2>&1; then
  echo "--- listeners ---"
  lsof -nP -iTCP:"$BACK_PORT" -sTCP:LISTEN || true
  lsof -nP -iTCP:"$FRONT_PORT" -sTCP:LISTEN || true
fi
