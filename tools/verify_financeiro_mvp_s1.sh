#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8001}"
TMP_DIR="${TMP_DIR:-/tmp}"
NOW_TS="$(date +%s)"
RUN_TAG="qa_mvp_s1_${NOW_TS}"

BODY_FILE="$TMP_DIR/${RUN_TAG}_body.json"
HTTP_CODE_FILE="$TMP_DIR/${RUN_TAG}_code.txt"
trap 'rm -f "$BODY_FILE" "$HTTP_CODE_FILE"' EXIT

say() { echo "[verify-mvp-s1] $*"; }
fail() { echo "[verify-mvp-s1][ERRO] $*" >&2; exit 1; }

req() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local url="${API_BASE}${path}"

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data" \
      -o "$BODY_FILE" \
      -w "%{http_code}" > "$HTTP_CODE_FILE"
  else
    curl -sS -X "$method" "$url" \
      -o "$BODY_FILE" \
      -w "%{http_code}" > "$HTTP_CODE_FILE"
  fi
}

expect_2xx() {
  local code
  code="$(cat "$HTTP_CODE_FILE")"
  if [[ ! "$code" =~ ^2[0-9][0-9]$ ]]; then
    echo "---- response body ----" >&2
    cat "$BODY_FILE" >&2 || true
    echo >&2
    fail "HTTP ${code} inesperado"
  fi
}

json_read() {
  local expr="$1"
  python3 - "$BODY_FILE" "$expr" <<'PY'
import json
import sys

body_path, expr = sys.argv[1], sys.argv[2]
with open(body_path, "r", encoding="utf-8") as f:
    data = json.load(f)

safe = {"isinstance": isinstance, "any": any, "all": all, "len": len, "str": str, "int": int, "float": float, "bool": bool, "list": list, "dict": dict, "tuple": tuple, "set": set}
value = eval(expr, {"__builtins__": {}, **safe}, {"data": data})
if value is None:
    print("")
elif isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(value)
PY
}

assert_json_true() {
  local expr="$1"
  local msg="$2"
  local out
  out="$(json_read "$expr")"
  [[ "$out" == "True" || "$out" == "true" ]] || fail "$msg"
}

gen_valid_cnpj() {
  python3 - <<'PY'
import random
import time

random.seed(time.time_ns())
base = [random.randint(0, 9) for _ in range(12)]
if len(set(base)) == 1:
    base[0] = (base[0] + 1) % 10

def dv(nums, weights):
    s = sum(n * w for n, w in zip(nums, weights))
    d = 11 - (s % 11)
    return 0 if d >= 10 else d

w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
d1 = dv(base, w1)
d2 = dv(base + [d1], w2)
cnpj = ''.join(map(str, base + [d1, d2]))
print(cnpj)
PY
}

say "Iniciando verificacao MVP-S1 em ${API_BASE}"

say "1/8 - Health check"
req "GET" "/health"
expect_2xx
assert_json_true "data.get('ok') is True" "Health sem ok=true"

say "2/8 - Seeds basicos"
for seed_path in \
  "/supplier-categories/seed-defaults" \
  "/supplier-tags/seed-defaults" \
  "/cost-centers/seed-defaults" \
  "/payment-methods/seed-defaults"
do
  req "POST" "$seed_path"
  expect_2xx
done

say "3/8 - Criar categoria e tag de fornecedor"
CATEGORY_NAME="QA Categoria ${NOW_TS}"
TAG_NAME="qa-tag-${NOW_TS}"
req "POST" "/supplier-categories" "{\"name\":\"${CATEGORY_NAME}\",\"is_active\":true}"
expect_2xx
CATEGORY_ID="$(json_read "data.get('id')")"
[[ -n "$CATEGORY_ID" && "$CATEGORY_ID" != "None" ]] || fail "Categoria sem ID"

req "POST" "/supplier-tags" "{\"name\":\"${TAG_NAME}\",\"is_active\":true}"
expect_2xx
TAG_ID="$(json_read "data.get('id')")"
[[ -n "$TAG_ID" && "$TAG_ID" != "None" ]] || fail "Tag sem ID"

say "4/8 - Criar fornecedor com categoria/tag e dados bancarios"
CNPJ="$(gen_valid_cnpj)"
SUPPLIER_NAME="Fornecedor QA ${NOW_TS}"
PERSON_PAYLOAD="$(cat <<JSON
{
  "name": "${SUPPLIER_NAME}",
  "document_type": "CNPJ",
  "document": "${CNPJ}",
  "city": "Januaria",
  "state": "MG",
  "is_supplier": true,
  "supplier_category_id": ${CATEGORY_ID},
  "supplier_tags_csv": "${TAG_NAME},nutricao",
  "bank_name": "Banco QA",
  "bank_branch": "0001",
  "bank_account": "12345-6",
  "pix_key": "financeiro-${NOW_TS}@qa.local",
  "pix_type": "EMAIL",
  "is_active": true
}
JSON
)"
req "POST" "/people" "$PERSON_PAYLOAD"
expect_2xx
PERSON_ID="$(json_read "data.get('id')")"
[[ -n "$PERSON_ID" && "$PERSON_ID" != "None" ]] || fail "Pessoa sem ID"

req "GET" "/people?role=supplier&supplier_category_id=${CATEGORY_ID}&q=${NOW_TS}"
expect_2xx
assert_json_true "isinstance(data, list) and len(data) >= 1" "Fornecedor nao retornou na listagem"
assert_json_true "any(str(x.get('id')) == str(${PERSON_ID}) for x in data)" "Fornecedor criado nao encontrado por filtro"

say "5/8 - Criar centro de custo"
COST_CODE="QA-${NOW_TS}"
COST_NAME="Centro QA ${NOW_TS}"
req "POST" "/cost-centers" "{\"code\":\"${COST_CODE}\",\"name\":\"${COST_NAME}\",\"is_active\":true}"
expect_2xx
COST_ID="$(json_read "data.get('id')")"
[[ -n "$COST_ID" && "$COST_ID" != "None" ]] || fail "Centro de custo sem ID"

req "GET" "/cost-centers?q=${NOW_TS}"
expect_2xx
assert_json_true "any(str(x.get('id')) == str(${COST_ID}) for x in data)" "Centro de custo nao retornou na listagem"

say "6/8 - Criar conta bancaria"
BANK_NAME="Conta QA ${NOW_TS}"
req "POST" "/bank-accounts" "{\"name\":\"${BANK_NAME}\",\"bank_name\":\"Banco do Brasil\",\"branch\":\"1111\",\"account_number\":\"99999-9\",\"account_type\":\"CORRENTE\",\"opening_balance\":5000,\"is_active\":true}"
expect_2xx
BANK_ID="$(json_read "data.get('id')")"
[[ -n "$BANK_ID" && "$BANK_ID" != "None" ]] || fail "Conta bancaria sem ID"

req "GET" "/bank-accounts?q=${NOW_TS}"
expect_2xx
assert_json_true "any(str(x.get('id')) == str(${BANK_ID}) for x in data)" "Conta bancaria nao retornou na listagem"

say "7/8 - Criar forma de pagamento"
PAYMENT_NAME="PIX QA ${NOW_TS}"
req "POST" "/payment-methods" "{\"name\":\"${PAYMENT_NAME}\",\"method_type\":\"PIX\",\"fee_percent\":0,\"term_days\":0,\"default_bank_account_id\":${BANK_ID},\"is_active\":true}"
expect_2xx
PM_ID="$(json_read "data.get('id')")"
[[ -n "$PM_ID" && "$PM_ID" != "None" ]] || fail "Forma de pagamento sem ID"

req "GET" "/payment-methods?q=${NOW_TS}"
expect_2xx
assert_json_true "any(str(x.get('id')) == str(${PM_ID}) for x in data)" "Forma de pagamento nao retornou na listagem"

say "8/8 - Validacao de duplicidade de documento (espera 422)"
req "POST" "/people" "$PERSON_PAYLOAD"
CODE="$(cat "$HTTP_CODE_FILE")"
[[ "$CODE" == "422" ]] || fail "Duplicidade de documento deveria retornar 422, retornou ${CODE}"

say "SUCESSO: MVP-S1 validado (cadastros base + validacoes principais)."
exit 0
