#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_UX_V5_REBANHO_QUICKWEIGH_SUBTABS"

echo "Aplicando UX V5 (Rebanho: Subtabs + Pesagem rápida)..."

# tenta localizar a raiz do repo (onde existe frontend/)
if [ ! -d "$ROOT/frontend" ] && [ -d "$PATCH_DIR/frontend" ]; then
  # quando o zip é descompactado na raiz do projeto, ROOT já é a raiz.
  # se não, aborta.
  :
fi

if [ ! -d "$ROOT/frontend" ]; then
  echo "ERRO: não encontrei a pasta frontend/ na raiz atual: $ROOT" >&2
  echo "Dica: descompacte este patch na raiz do projeto (onde existe frontend/)." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/ux_v5_rebanho_$TS"
mkdir -p "$BK"

FILES=(
  "frontend/src/pages/Herd.jsx"
)

for f in "${FILES[@]}"; do
  src="$PATCH_DIR/$f"
  dst="$ROOT/$f"
  if [ ! -f "$src" ]; then
    echo "ERRO: arquivo do patch não encontrado: $src" >&2
    exit 1
  fi
  if [ -f "$dst" ]; then
    mkdir -p "$BK/$(dirname "$f")"
    cp -a "$dst" "$BK/$f"
  fi
  mkdir -p "$(dirname "$dst")"
  cp -a "$src" "$dst"
done

echo "OK ✅ Patch aplicado. Backup em: $BK"
