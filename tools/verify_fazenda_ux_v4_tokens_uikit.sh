#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
[ -d "$ROOT/frontend" ] || { echo "ERRO: rode na raiz do projeto (pasta que contém frontend/)."; exit 1; }

echo "Verificando FAZENDA UX V4..."

TOK="$ROOT/frontend/src/styles/fazenda_tokens.css"
[ -f "$TOK" ] || { echo "ERRO: não achei $TOK"; exit 1; }

MAIN="$ROOT/frontend/src/main.jsx"
grep -q "fazenda_tokens.css" "$MAIN" || { echo "ERRO: main.jsx não importou fazenda_tokens.css"; exit 1; }
grep -q "cras_ui_v2.css" "$MAIN" || { echo "ERRO: main.jsx não importou cras_ui_v2.css"; exit 1; }

echo "OK ✅ Arquivos e imports conferidos."

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "Rodando build do frontend (pode demorar um pouco)..."
  (cd "$ROOT/frontend" && npm run build)
  echo "OK ✅ build passou."
else
  echo "SKIP_BUILD=1 -> pulando build."
fi

echo "VERIFY OK ✅"
