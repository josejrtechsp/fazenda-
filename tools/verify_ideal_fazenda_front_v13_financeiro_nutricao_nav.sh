#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "== Verificando IDEAL Fazenda Front V13 (Financeiro + Nav Nutrição) =="

# arquivos
[ -f frontend/src/pages/Financeiro.jsx ] || { echo "ERRO: frontend/src/pages/Financeiro.jsx não existe"; exit 1; }
[ -f frontend/src/styles/financeiro.css ] || { echo "ERRO: frontend/src/styles/financeiro.css não existe"; exit 1; }

# lib/api.js exporta { api } (named). Se importar como default, quebra e dá tela em branco.
if grep -Fq 'import api from "../lib/api.js"' frontend/src/pages/Financeiro.jsx; then
  echo 'ERRO: Financeiro.jsx está importando api como default. Use: import { api } from "../lib/api.js"';
  exit 1
fi

grep -Eq 'import[[:space:]]+\{[[:space:]]*api[[:space:]]*\}[[:space:]]+from[[:space:]]+"\.\./lib/api\.js"' frontend/src/pages/Financeiro.jsx \
  || { echo 'ERRO: Financeiro.jsx deve importar { api } de ../lib/api.js'; exit 1; }

# integrações no app
grep -Fq "import Financeiro" frontend/src/FazendaApp.jsx || { echo "ERRO: FazendaApp não importa Financeiro"; exit 1; }
grep -Fq "import NutricaoComprasItens" frontend/src/FazendaApp.jsx || { echo "ERRO: FazendaApp não importa NutricaoComprasItens"; exit 1; }

grep -Fq "case \"feed\"" frontend/src/FazendaApp.jsx || { echo "ERRO: FazendaApp não tem case \"feed\""; exit 1; }
grep -Fq "case \"finance\"" frontend/src/FazendaApp.jsx || { echo "ERRO: FazendaApp não tem case \"finance\""; exit 1; }

grep -Fq "onNavigate" frontend/src/pages/ProducerDashboard.jsx || { echo "ERRO: ProducerDashboard não tem onNavigate"; exit 1; }

echo "OK: Front V13 (Financeiro + nav Nutrição) aplicado."
