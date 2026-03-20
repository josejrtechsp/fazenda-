#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:8001}"
FRONT_BASE="${FRONT_BASE:-http://127.0.0.1:5173}"
export API_BASE

say() { echo "[checks-smoke] $*"; }
fail() { echo "[checks-smoke][ERRO] $*" >&2; exit 1; }

require_up() {
  local url="$1"
  local name="$2"
  if ! curl -fsS -m 10 "$url" >/dev/null; then
    fail "$name nao respondeu em $url"
  fi
}

require_front_title() {
  local attempts="${1:-5}"
  local html=""
  for _ in $(seq 1 "$attempts"); do
    html="$(curl -fsS -m 15 "$FRONT_BASE" || true)"
    if echo "$html" | grep -qi "IDEAL Fazenda"; then
      return 0
    fi
    sleep 2
  done
  fail "Frontend respondeu sem titulo esperado (IDEAL Fazenda)"
}

say "1/5 Verificando backend health"
require_up "${API_BASE}/health" "Backend"

say "2/5 Smoke funcional financeiro/cadastros"
"$ROOT/tools/verify_financeiro_mvp_s1.sh"

say "3/5 Smoke de alcadas por faixas"
"$ROOT/tools/smoke_finance_approval_tiers.py" --base "$API_BASE"

say "4/5 Verificando frontend online"
require_front_title 5

say "5/5 Build frontend"
(cd "$ROOT/frontend" && npm run build >/dev/null)

say "OK: smoke checks concluidos com sucesso."
