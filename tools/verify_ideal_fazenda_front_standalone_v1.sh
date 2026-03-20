#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Front (Standalone) V1 =="

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

need() {
  if [ ! -e "$ROOT/$1" ]; then
    echo "FALTA: $1"
    exit 1
  fi
}

need "frontend/package.json"
need "frontend/vite.config.js"
need "frontend/index.html"
need "frontend/src/main.jsx"
need "frontend/src/FazendaApp.jsx"
need "frontend/src/pages/ProducerDashboard.jsx"
need "frontend/src/pages/WhatsAppValidations.jsx"
need "frontend/src/components/CrasSidebarNav.jsx"
need "frontend/src/components/CrasPageHeader.jsx"
need "frontend/src/components/FazendaTopHeader.jsx"
need "frontend/src/styles/App.css"
need "frontend/src/styles/cras_ui_v2.css"
need "frontend/src/styles/cras_actions_apple.css"

echo "OK: estrutura mínima presente."
echo "DICA: para rodar -> cd "$ROOT/frontend" && npm install && npm run dev"
