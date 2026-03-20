#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$ROOT_DIR/patches/FAZENDA_SIDEBAR_UX_V3_DRAWER"

if [ ! -d "$PATCH_DIR" ]; then
  echo "ERRO: patch dir não encontrado: $PATCH_DIR" >&2
  exit 1
fi

echo "Aplicando PATCH FAZENDA UX V3 (drawer + tokens + status)..."

# backup rápido (somente arquivos-alvo)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT_DIR/Arquivo/_tmp/ux_v3_$TS"
mkdir -p "$BK"

# copia os arquivos atuais para backup, se existirem
for f in \
  frontend/src/main.jsx \
  frontend/src/FazendaApp.jsx \
  frontend/src/components/FazendaTopHeader.jsx \
  frontend/src/styles/fazenda_header_overrides.css \
  frontend/src/styles/cras_ui_v2.css \
  frontend/src/pages/ProducerDashboard.jsx \
  frontend/src/styles/producer_dashboard_fix.css
  do
    if [ -f "$ROOT_DIR/$f" ]; then
      mkdir -p "$BK/$(dirname "$f")"
      cp -a "$ROOT_DIR/$f" "$BK/$f"
    fi
  done

# aplica patch (merge)
rsync -a "$PATCH_DIR/" "$ROOT_DIR/"

echo "OK ✅ Patch aplicado."
echo "Backup em: $BK"
