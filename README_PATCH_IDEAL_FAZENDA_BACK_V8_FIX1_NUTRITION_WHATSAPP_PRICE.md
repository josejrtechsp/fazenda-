# IDEAL Fazenda — Back V8 FIX1 (Nutrição WhatsApp + Preço Automático)

Este patch corrige dois pontos:

1) **WhatsApp/NLP**: frases como `coloquei 300 kg de silagem de milho na manga 30` agora entram como **custo (Nutrição)** e **não** como transferência.
2) **Preço automático**: no WhatsApp, o vaqueiro informa apenas **quantidade + unidade + manga/lote**. O sistema busca o **último preço de compra** do item e calcula:
   - `unit_price_brl` (na unidade do lançamento)
   - `value_brl` (qty * unit_price_brl)

Além disso:
- `/nutrition/purchases` passa a aceitar `item_name` (ou `name`/`item`) no lugar de `item_id`.
- Corrige o aviso `grep: parentheses not balanced` no script de apply do V8.

## Como aplicar

Na raiz do projeto (pasta `IDEAL_FAZENDA`):

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"

unzip -o "PATCH_IDEAL_FAZENDA_BACK_V8_FIX1_NUTRITION_WHATSAPP_PRICE.zip" -d .

# verificação
bash tools/verify_ideal_fazenda_back_v8_fix1_whatsapp_nutrition.sh

# subir o back
cd "$PROJ/backend"
./run_dev.sh
```

## Teste rápido (exemplo)

1) Crie/garanta itens (uma vez):

```bash
curl -s -X POST "http://localhost:8001/nutrition/seed-default"; echo
```

2) Registre uma compra (exemplos):

```bash
# aceita item_name
curl -s -X POST "http://localhost:8001/nutrition/purchases" \
  -H "Content-Type: application/json" \
  -d '{"item_name":"Ração concentrada","qty":50,"unit":"saco","unit_price_brl":120,"occurred_at":"2026-01-15"}'; echo

curl -s -X POST "http://localhost:8001/nutrition/purchases" \
  -H "Content-Type: application/json" \
  -d '{"item_name":"Silagem de milho","qty":10,"unit":"ton","unit_price_brl":350,"occurred_at":"2026-01-15"}'; echo
```

3) WhatsApp ingest (o sistema calcula o valor):

```bash
curl -s -X POST "http://localhost:8001/whatsapp/ingest" \
  -H "Content-Type: application/json" \
  -d '{"text":"dei 1 saco de ração na manga 30"}'; echo

curl -s -X POST "http://localhost:8001/whatsapp/ingest" \
  -H "Content-Type: application/json" \
  -d '{"text":"coloquei 300 kg de silagem de milho na manga 30"}'; echo
```

