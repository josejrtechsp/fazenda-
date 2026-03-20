#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PAGE="$ROOT_DIR/frontend/src/pages/NutricaoComprasItens.jsx"
CSS="$ROOT_DIR/frontend/src/styles/nutricao_admin.css"
APP="$ROOT_DIR/frontend/src/FazendaApp.jsx"

if [ ! -f "$PAGE" ]; then
  echo "ERRO: faltando $PAGE"
  exit 1
fi

if [ ! -f "$CSS" ]; then
  echo "ERRO: faltando $CSS"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app = Path("frontend/src/FazendaApp.jsx").read_text(encoding="utf-8", errors="ignore")
page = Path("frontend/src/pages/NutricaoComprasItens.jsx").read_text(encoding="utf-8", errors="ignore")

assert "NutricaoComprasItens" in app, "FazendaApp.jsx não referencia NutricaoComprasItens (import/uso)"
assert "../styles/nutricao_admin.css" in page, "NutricaoComprasItens.jsx não importa nutricao_admin.css"

print("OK: NutricaoComprasItens.jsx presente e CSS importado (V13 Fix1)")
PY
