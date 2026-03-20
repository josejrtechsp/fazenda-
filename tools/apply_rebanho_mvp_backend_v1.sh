#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

if [ ! -d "$ROOT/backend" ]; then
  echo "ERRO: não encontrei a pasta 'backend' em: $ROOT"
  echo "Entre na raiz do projeto (onde existe backend/) e rode novamente."
  exit 1
fi

SRC="$ROOT/patches/REBANHO_MVP_BACKEND_V1"
if [ ! -d "$SRC" ]; then
  echo "ERRO: pasta de patch não encontrada: $SRC"
  exit 1
fi

echo "Aplicando patch Rebanho MVP Backend V1..."
# rsync é padrão no macOS
rsync -a --delete "$SRC/backend/rebanho_mvp/" "$ROOT/backend/rebanho_mvp/"
rsync -a "$SRC/backend/run_rebanho_mvp.sh" "$ROOT/backend/run_rebanho_mvp.sh"

chmod +x "$ROOT/backend/run_rebanho_mvp.sh" || true

echo "OK ✅ Patch aplicado."
echo "Próximo passo: rode o verify:"
echo "  bash tools/verify_rebanho_mvp_backend_v1.sh"
