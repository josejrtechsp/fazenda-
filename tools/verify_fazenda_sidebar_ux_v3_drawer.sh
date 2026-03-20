#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Verificando PATCH FAZENDA UX V3..."

req(){
  local f="$1"; shift
  if [ ! -f "$ROOT_DIR/$f" ]; then
    echo "ERRO: arquivo ausente: $f" >&2
    exit 1
  fi
}

grepq(){
  local f="$1"; local pat="$2"
  if ! grep -q "$pat" "$ROOT_DIR/$f"; then
    echo "ERRO: padrão não encontrado em $f: $pat" >&2
    exit 1
  fi
}

grepnq(){
  local f="$1"; local pat="$2"
  if grep -q "$pat" "$ROOT_DIR/$f"; then
    echo "ERRO: padrão deveria ter sido removido de $f: $pat" >&2
    exit 1
  fi
}

req frontend/src/main.jsx
req frontend/src/FazendaApp.jsx
req frontend/src/components/FazendaTopHeader.jsx
req frontend/src/styles/fazenda_header_overrides.css
req frontend/src/styles/cras_ui_v2.css
req frontend/src/pages/ProducerDashboard.jsx
req frontend/src/styles/producer_dashboard_fix.css

grepq frontend/src/main.jsx "cras_ui_v2.css"
grepq frontend/src/FazendaApp.jsx "nav-open"
grepq frontend/src/FazendaApp.jsx "cras-nav-scrim"
grepq frontend/src/components/FazendaTopHeader.jsx "app-header-menuBtn"
grepq frontend/src/styles/cras_ui_v2.css "Drawer nav"
grepq frontend/src/styles/cras_ui_v2.css "cras-nav-scrim{ display: none; }"
grepq frontend/src/pages/ProducerDashboard.jsx "pd-connPill"
grepnq frontend/src/pages/ProducerDashboard.jsx "pd-offlineText"

echo "OK ✅ Verify passou."
