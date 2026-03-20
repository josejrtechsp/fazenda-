#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

need(){
  if [ ! -f "$ROOT/$1" ]; then
    echo "FALTA: $1" >&2
    exit 1
  fi
}

need "frontend/src/components/FazendaTopHeader.jsx"
need "frontend/src/styles/fazenda_header_overrides.css"
need "frontend/src/styles/producer_dashboard_fix.css"

if grep -q "SOLUCOES PARA PECUARIA" "$ROOT/frontend/src/components/FazendaTopHeader.jsx"; then
  echo "ERRO: texto do lockup ainda presente no header." >&2
  exit 1
fi

if ! grep -q "ProducerDashboard FIX11" "$ROOT/frontend/src/styles/producer_dashboard_fix.css"; then
  echo "ERRO: producer_dashboard_fix.css nao parece ser o FIX11." >&2
  exit 1
fi

echo "OK: FIX11 aplicado (header sem lockup direito + dashboard mais compacto)."
