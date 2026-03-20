#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Verificando IDEAL Fazenda BACK (WhatsApp NLP) =="

# checagens de arquivos
[ -f "$ROOT_DIR/backend/app/routers/whatsapp.py" ] || { echo "ERRO: whatsapp.py não encontrado"; exit 1; }

# valida sintaxe (não precisa das deps)
python3 -m py_compile "$ROOT_DIR/backend/app/routers/whatsapp.py"

echo "OK: sintaxe do whatsapp.py passou."
