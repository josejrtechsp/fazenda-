#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/frontend/package.json"

if [ ! -f "$PKG" ]; then
  echo "FALTA: frontend/package.json" >&2
  exit 1
fi

# simple checks
node_ver="$(node -v 2>/dev/null || true)"
if [ -z "$node_ver" ]; then
  echo "WARN: node não encontrado no PATH. Instale Node via brew." >&2
fi

grep -q '"@vitejs/plugin-react"[[:space:]]*:[[:space:]]*"4.2.1"' "$PKG" || {
  echo "FALTA: @vitejs/plugin-react fixado em 4.2.1" >&2
  exit 1
}

grep -q '"vite"[[:space:]]*:[[:space:]]*"5.4.8"' "$PKG" || {
  echo "FALTA: vite fixado em 5.4.8" >&2
  exit 1
}

echo "OK: IDEAL Fazenda Front V4 FIX2 (deps fixadas: vite 5.4.8 + plugin-react 4.2.1)"
echo "DICA: apague node_modules + package-lock.json e rode npm install nesta máquina." 
