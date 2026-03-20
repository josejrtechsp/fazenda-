#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/frontend/src/pages/Herd.jsx"

if [ ! -f "$TARGET" ]; then
  echo "ERRO: Não achei $TARGET"
  exit 1
fi

grep -q "REBANHO (REWRITE CLEAN V2.1)" "$TARGET" && echo "OK ✅ marcador V2.1 encontrado." || (echo "ERRO: marcador V2.1 não encontrado"; exit 1)

# Checagens rápidas do CSV
grep -q 'function toCsv' "$TARGET" && echo "OK ✅ toCsv presente." || (echo "ERRO: toCsv não encontrado"; exit 1)
grep -q 'join("\\n")' "$TARGET" && echo "OK ✅ join(\\n) presente." || (echo "ERRO: join(\\n) não encontrado"; exit 1)

echo "Rodando build do frontend..."
cd "$ROOT/frontend"
npm run build
echo "OK ✅ build passou."
