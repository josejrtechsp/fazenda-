#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

MAIN="$ROOT_DIR/backend/app/main.py"

if [ ! -f "$MAIN" ]; then
  echo "ERRO: nao achei $MAIN"
  exit 1
fi

# Ensure models imported somewhere so SQLModel sees tables
MODELS_INIT="$ROOT_DIR/backend/app/models/__init__.py"
mkdir -p "$ROOT_DIR/backend/app/models"
if [ ! -f "$MODELS_INIT" ]; then
  cat > "$MODELS_INIT" <<'PY'
# app.models package
PY
fi

# Add import in models/__init__.py (idempotent)
if ! grep -q "nutrition" "$MODELS_INIT"; then
  echo "from app.models.nutrition import NutritionItem, NutritionPurchase" >> "$MODELS_INIT"
fi

# Ensure init_db imports models package to register metadata
if ! grep -q "import app.models" "$MAIN"; then
  # insert after FastAPI import block
  perl -0777 -i -pe 's/(from fastapi import FastAPI\n)/$1\nimport app.models\n/;' "$MAIN"
fi

# Include router
if ! grep -q "routers.nutrition" "$MAIN"; then
  perl -0777 -i -pe 's/(from app\.routers\.[^\n]+ import router as [^\n]+\n)/$1from app.routers.nutrition import router as nutrition_router\n/;' "$MAIN"
fi

# Add include_router call if not present
if ! grep -q "nutrition_router" "$MAIN"; then
  # fallback: add import at end of router imports
  echo "from app.routers.nutrition import router as nutrition_router" >> "$MAIN"
fi

if ! grep -q "include_router(nutrition_router" "$MAIN"; then
  perl -0777 -i -pe 's/(app\.include_router\([^\n]+\)\n)/$1app.include_router(nutrition_router)\n/;' "$MAIN";
fi

echo "OK: Back V8 nutrition aplicado."
