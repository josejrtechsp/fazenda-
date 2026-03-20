#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"
npm run build

echo "OK: Front V15J (header -40 / dashboard -30 + textos)" 
