#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
F="$ROOT/frontend/src/components/FazendaTopHeader.jsx"

echo "== verify_ideal_fazenda_front_header_fluxos =="
[ -f "$F" ] || { echo "ERRO: não existe $F"; exit 1; }

grep -q 'className="app-header"' "$F" || { echo "ERRO: header não usa app-header"; exit 1; }

grep -q 'Período:' "$F" || { echo "ERRO: faltou linha Período"; exit 1; }

grep -q 'Fazenda:' "$F" || { echo "ERRO: faltou linha Fazenda"; exit 1; }

echo "OK: header da fazenda alinhado ao cabeçalho dos fluxos (app-header)."
