#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.runlogs"

kill_pid_file() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "${pid:-}" ]; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

kill_pid_file "$LOG_DIR/back.pid"
kill_pid_file "$LOG_DIR/front.pid"
"$ROOT/tools/kill_ports.sh" all >/dev/null 2>&1 || true

echo "Backend + frontend encerrados."

