#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CMD="${1:-all}"

BACK_PORT="${BACK_PORT:-8001}"
FRONT_PORT="${FRONT_PORT:-5173}"
HOST="${HOST:-127.0.0.1}"
FRONT_MODE="${FRONT_MODE:-dev}"

die() { echo "ERRO: $*" >&2; exit 1; }

[ -d "$ROOT/backend" ] || die "backend/ não encontrado em $ROOT"
[ -d "$ROOT/frontend" ] || die "frontend/ não encontrado em $ROOT"

start_back() {
  [ -x "$ROOT/backend/.venv/bin/python" ] || die "backend/.venv não encontrado. Rode: ./run_all.sh setup-back"
  [ -f "$ROOT/backend/app/main.py" ] || die "backend/app/main.py não encontrado (entrypoint esperado)."
  "$ROOT/tools/kill_ports.sh" "$BACK_PORT" >/dev/null || true
  echo "BACKEND: http://$HOST:$BACK_PORT/docs"
  (
    cd "$ROOT/backend" && ./.venv/bin/python -m uvicorn app.main:app \
      --reload \
      --reload-exclude ".venv/*" \
      --reload-exclude "**/__pycache__/*" \
      --reload-exclude "**/*.pyc" \
      --host "$HOST" \
      --port "$BACK_PORT"
  )
}

start_front() {
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "node_modules não encontrado; rodando npm install..."
    (cd "$ROOT/frontend" && npm install)
  fi
  "$ROOT/tools/kill_ports.sh" "$FRONT_PORT" >/dev/null || true
  echo "FRONTEND: http://$HOST:$FRONT_PORT (mode=$FRONT_MODE)"
  if [ "$FRONT_MODE" = "preview" ]; then
    (cd "$ROOT/frontend" && npm run build >/dev/null && npm run preview -- --host "$HOST" --port "$FRONT_PORT")
  else
    (cd "$ROOT/frontend" && npm run dev -- --host "$HOST" --port "$FRONT_PORT")
  fi
}

case "$CMD" in
  kill) "$ROOT/tools/kill_ports.sh" all ;;
  setup-back) "$ROOT/tools/setup_backend_312.sh" "$ROOT" ;;
  setup-front) "$ROOT/tools/setup_frontend.sh" "$ROOT" ;;
  back) start_back ;;
  front) start_front ;;
  all)
    "$ROOT/tools/kill_ports.sh" all >/dev/null || true
    echo "Iniciando BACK (bg) + FRONT (fg)..."
    (start_back) &
    BACK_PID=$!
    trap 'echo; echo "Encerrando..."; kill -9 $BACK_PID 2>/dev/null || true' INT TERM EXIT
    start_front
    ;;
  *)
    echo "Uso: ./run_all.sh [all|back|front|kill|setup-back|setup-front]"
    exit 2
    ;;
esac
