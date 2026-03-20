# IDEAL Fazenda — Patch BACK V5

## O que entra

### 1) Transferência por **brinco/ID** (WhatsApp)
Agora o parser do WhatsApp reconhece transferência do tipo:
- `mudei gado 30 do lote 10 para o lote 15`
- `transferi brincos 30 31 32 do lote 10 para o lote 15`
- `passei brincos A12, B33 da manga 30 pra manga 12`

Campos gerados no evento (payload):
- `transfer_mode`: `"ear_tags"` ou `"heads"`
- `ear_tags`: lista de brincos (quando existir)
- `qty_heads`: quantidade (quando existir)
- `origin` / `destination`: lote/manga

Se não encontrar quantidade **nem** brincos, marca `missing_fields = ["qty_heads_or_ear_tags"]`.

### 2) Perguntas (follow-up) atualizadas
O endpoint `GET /whatsapp/questions/{event_id}` passa a perguntar também sobre:
- `qty_heads_or_ear_tags`

### 3) Resumo do mês pronto para WhatsApp
Novo endpoint:
- `GET /producer/monthly-summary-text?month=YYYY-MM`

Retorna `{"text":"..."}` pronto para copiar/colar no WhatsApp do produtor.

## Como aplicar

Na raiz do projeto `IDEAL_FAZENDA`:

```bash
unzip -o PATCH_IDEAL_FAZENDA_BACK_V5_WHATSAPP_TRANSFER_EARTAGS_SUMMARY.zip -d .

bash tools/verify_ideal_fazenda_back_v5_whatsapp_transfer.sh

cd backend
./run_dev.sh
```

## Testes rápidos

### Criar evento pendente (transfer por brinco)
```bash
curl -s -X POST "http://localhost:8001/whatsapp/ingest" \
  -H "Content-Type: application/json" \
  -d '{"text":"mudei gado 30 do lote 10 para o lote 15"}'
```

### Texto do resumo do mês
```bash
curl -s "http://localhost:8001/producer/monthly-summary-text"
```
