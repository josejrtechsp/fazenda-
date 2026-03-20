#!/usr/bin/env bash
set -euo pipefail

echo "== Verificando IDEAL Fazenda Front (Standalone) V2 =="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

need(){
  if [ ! -f "$ROOT_DIR/$1" ]; then
    echo "FALTA: $1"
    exit 1
  fi
}

need "frontend/package.json"
need "frontend/src/FazendaApp.jsx"
need "frontend/src/pages/ProducerDashboard.jsx"
need "frontend/src/pages/WhatsAppValidations.jsx"
need "frontend/src/pages/AreasPasture.jsx"
need "frontend/src/pages/Transfers.jsx"
need "frontend/src/components/CrasSidebarNav.jsx"
need "frontend/src/styles/fazenda_extras.css"

# Checagens leves de conteúdo (sem depender de npm)
grep -q "Mangas & Pasto" "$ROOT_DIR/frontend/src/pages/AreasPasture.jsx" || (echo "FALTA: texto Mangas & Pasto" && exit 1)
grep -q "Transferências" "$ROOT_DIR/frontend/src/pages/Transfers.jsx" || (echo "FALTA: texto Transferências" && exit 1)
grep -q "topBadge" "$ROOT_DIR/frontend/src/components/CrasSidebarNav.jsx" || (echo "FALTA: topBadge no sidebar" && exit 1)

echo "OK: arquivos e estruturas presentes."
echo "Dica: rode 'npm run dev' em frontend/ para validar no navegador."
