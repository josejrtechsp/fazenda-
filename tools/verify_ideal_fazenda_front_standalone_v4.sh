#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

need(){
  if [ ! -f "$ROOT_DIR/$1" ]; then
    echo "FALTA: $1"
    exit 1
  fi
}

need "frontend/src/lib/api.js"
need "frontend/src/pages/ProducerDashboard.jsx"
need "frontend/src/pages/WhatsAppValidations.jsx"
need "frontend/src/pages/Transfers.jsx"
need "frontend/.env.example"

echo "OK: verify_ideal_fazenda_front_standalone_v4"
