#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/frontend/src/pages/ProducerDashboard.jsx"

if [ ! -f "$F" ]; then
  echo "ERRO: nao achei ProducerDashboard.jsx em: $F"
  exit 1
fi

# Helpers e suporte a formatos diferentes do backend
grep -q "function normKey" "$F" || { echo "ERRO: helper normKey nao encontrado"; exit 1; }
grep -q "function getTopCostValue" "$F" || { echo "ERRO: helper getTopCostValue nao encontrado"; exit 1; }
grep -q "Array.isArray" "$F" || { echo "ERRO: nao encontrei tratamento de Array.isArray(top_costs)"; exit 1; }

# Garante que o card de top custos usa getTopCostValue
grep -Fq "getTopCostValue(" "$F" || { echo "ERRO: topCosts nao usa getTopCostValue"; exit 1; }

echo "OK: Front fix top_costs (aceita lista ou objeto)"
