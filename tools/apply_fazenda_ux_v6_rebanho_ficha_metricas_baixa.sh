#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$ROOT/patches/FAZENDA_UX_V6_REBANHO_FICHA_METRICAS_BAIXA"

echo "Aplicando UX V6 (Rebanho: Ficha com métricas + baixa + voltar inteligente)..."

if [ ! -d "$ROOT/frontend" ]; then
  echo "ERRO: não encontrei a pasta frontend/ na raiz atual: $ROOT" >&2
  echo "Dica: descompacte este patch na raiz do projeto (onde existe frontend/)." >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/Arquivo/_tmp/ux_v6_rebanho_$TS"
mkdir -p "$BK"

FILES=(
  "frontend/src/pages/Herd.jsx"
  "frontend/src/styles/herd_rebanho_fix.css"
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
