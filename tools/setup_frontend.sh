#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-}"
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

FRONT="$ROOT/frontend"
[ -d "$FRONT" ] || { echo "ERRO: frontend/ não encontrado em $ROOT"; exit 1; }

command -v node >/dev/null 2>&1 || { echo "ERRO: node não encontrado."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERRO: npm não encontrado."; exit 1; }

cd "$FRONT"
npm install
echo "OK ✅ Frontend pronto."
