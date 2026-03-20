#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"

# Apply CSS import if needed
bash "$ROOT_DIR/tools/apply_front_v15k.sh" >/dev/null

npm run build

echo "OK: Front V15K (harmony fine tuning) build passou."
