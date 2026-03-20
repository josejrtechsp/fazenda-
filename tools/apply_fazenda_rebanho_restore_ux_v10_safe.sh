#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_REBANHO_RESTORE_UX_V10_SAFE"

HFILE="$ROOT/frontend/src/pages/Herd.jsx"
CSS="$ROOT/frontend/src/styles/herd_rebanho_fix.css"

if [ ! -d "$ROOT/frontend" ]; then
  echo "ERRO: não encontrei a pasta frontend/ na raiz atual: $ROOT" >&2
  exit 1
fi

if [ ! -f "$HFILE" ]; then
  echo "ERRO: não encontrei $HFILE" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/rebanho_restore_ux_v10_$TS"
mkdir -p "$BK"
cp -v "$HFILE" "$BK/Herd.jsx.bak"
cp -v "$CSS" "$BK/herd_rebanho_fix.css.bak" || true

# Sobrescreve Herd.jsx (remove placeholder)
cp -v "$PATCH_DIR/frontend/src/pages/Herd.jsx" "$HFILE"

# Append CSS addon se não existir
ADDON="$PATCH_DIR/frontend/src/styles/herd_rebanho_fix.css.addon"
MARK="UX V10 — Rebanho (Overview painel + Animais em cards)"
if [ -f "$CSS" ] && ! grep -q "$MARK" "$CSS"; then
  echo "" >> "$CSS"
  cat "$ADDON" >> "$CSS"
  echo "OK: CSS UX V10 anexado em $CSS"
else
  echo "OK: CSS já contém UX V10 (ou arquivo não existe)."
fi

echo "OK ✅ Patch aplicado."
echo "Backup em: $BK"
