# PATCH IDEAL Fazenda BACK V5 — WhatsApp Transfer (brincos) + Resumo WhatsApp

Este patch melhora o fluxo de WhatsApp no backend:

## 1) Transferência por brinco/ID (animal individual)
- Agora o parser reconhece frases como:
  - "mudei gado 30 do lote 10 para o lote 15"
  - "transferi brincos 30 31 A12 do lote 10 para o lote 15"
- Campos adicionados no payload de `type=transfer`:
  - `ear_tags`: lista de IDs/brincos (strings)
  - `transfer_mode`: `ear_tags` ou `heads`
- Se a mensagem não trouxer nem cabeças nem brincos, o NLP marca `missing_fields: ["qty_heads_or_ear_tags"]`.

## 2) Perguntas (follow-up)
- `/whatsapp/questions/{event_id}` agora pergunta também quando faltar `qty_heads_or_ear_tags`.

## 3) Resumo do mês pronto para WhatsApp
- Novo endpoint: `GET /producer/monthly-summary-text?month=YYYY-MM`
  - Retorna: `{ "month": "YYYY-MM", "text": "..." }`

## Aplicar
```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_BACK_V5_WHATSAPP_TRANSFER_SUMMARY.zip -d .

bash tools/verify_ideal_fazenda_back_v5_whatsapp_transfer.sh
```

Depois reinicie o backend:
```bash
cd "$PROJ/backend"
./run_dev.sh
```
