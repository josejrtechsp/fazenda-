#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/frontend/src/pages/Herd.jsx"
if [[ ! -f "$F" ]]; then
  echo "ERRO: Herd.jsx nao encontrado em $F" >&2
  exit 1
fi
if ! grep -q "const k = a\?\.key \|\| a" "$F"; then
  echo "ERRO: handler onAction ainda nao adaptado para receber objeto" >&2
  exit 1
fi
if ! grep -q "/herd/seed-demo" "$F"; then
  echo "ERRO: chamada /herd/seed-demo nao encontrada" >&2
  exit 1
fi
echo "OK: FIX Seed Rebanho (click) aplicado."
