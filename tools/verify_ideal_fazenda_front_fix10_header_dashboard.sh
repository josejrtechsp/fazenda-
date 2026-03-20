#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HDR="$ROOT/frontend/src/components/FazendaTopHeader.jsx"
CSS="$ROOT/frontend/src/styles/producer_dashboard_fix.css"
HCSS="$ROOT/frontend/src/styles/fazenda_header_overrides.css"

echo "== IDEAL FAZENDA | verify front FIX10 (header + dashboard) =="

for f in "$HDR" "$CSS" "$HCSS"; do
  if [[ ! -f "$f" ]]; then
    echo "ERRO: arquivo nao encontrado: $f" >&2
    exit 1
  fi
  echo "OK: $f"
done

grep -q "app-header-fazenda" "$HDR" || { echo "ERRO: header sem class app-header-fazenda" >&2; exit 1; }
if grep -q "header-user-row" "$HDR"; then
  echo "ERRO: header ainda contem header-user-row" >&2
  exit 1
fi

grep -q "FIX10" "$CSS" || { echo "ERRO: producer_dashboard_fix.css nao esta no FIX10" >&2; exit 1; }

echo "OK: verificacao concluida." 
