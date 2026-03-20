#!/usr/bin/env bash
set -euo pipefail

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti :"$port" 2>/dev/null || true)"
    if [ -n "${pids:-}" ]; then
      echo "Matando processos na porta $port: $pids"
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    else
      echo "Porta $port: sem processos."
    fi
  else
    echo "ERRO: lsof não encontrado."
    exit 1
  fi
}

case "${1:-all}" in
  8001) kill_port 8001 ;;
  5173) kill_port 5173 ;;
  all)  kill_port 8001; kill_port 5173 ;;
  *) echo "Uso: tools/kill_ports.sh [all|8001|5173]"; exit 2 ;;
esac
