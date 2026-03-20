#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Front V12 FIX3 (ProducerDashboard normalizeLabel) =="

FILE="frontend/src/pages/ProducerDashboard.jsx"

if [ ! -f "$FILE" ]; then
  echo "ERRO: $FILE não encontrado. Rode a partir da raiz do projeto IDEAL_FAZENDA." >&2
  exit 1
fi

# Checagens simples para evitar 'página em branco' por ReferenceError
if ! grep -q "function normalizeLabel" "$FILE"; then
  echo "ERRO: normalizeLabel não está definido em ProducerDashboard.jsx" >&2
  exit 1
fi

if grep -q "normalizeLabel" "$FILE" && ! grep -q "function normalizeLabel" "$FILE"; then
  echo "ERRO: ProducerDashboard usa normalizeLabel mas não define a função" >&2
  exit 1
fi

echo "OK: ProducerDashboard tem normalizeLabel e não deve quebrar por ReferenceError."
