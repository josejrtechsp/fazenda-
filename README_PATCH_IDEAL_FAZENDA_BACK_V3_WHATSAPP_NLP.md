# PATCH — IDEAL Fazenda BACK V3 (WhatsApp NLP + ingest)

Este patch melhora a integração WhatsApp no backend:

- Mantém a verificação do webhook (`GET /whatsapp/webhook`)
- Recebe webhook (`POST /whatsapp/webhook`) e:
  - Se for texto, cria automaticamente um **Event** pendente interpretado (`cost`, `transfer`, `exit`, `occurrence`)
  - Se for áudio/mídia, salva como `whatsapp_raw` pendente (para transcrever e validar)
- Adiciona endpoints de teste:
  - `POST /whatsapp/parse` (parse-only)
  - `POST /whatsapp/ingest` (salva um evento pendente)
  - `POST /whatsapp/simulate` (atalho para desenvolvimento)

## Como aplicar

No diretório raiz do projeto (onde existem `frontend/` e `backend/`):

```bash
unzip -o PATCH_IDEAL_FAZENDA_BACK_V3_WHATSAPP_NLP.zip -d .
bash tools/verify_ideal_fazenda_back_v3_whatsapp.sh
```

## Teste rápido (curl)

```bash
curl -s -X POST http://localhost:8001/whatsapp/ingest \
  -H 'Content-Type: application/json' \
  -d '{"text":"hoje eu dei 1 saco de ração na manga 30 R$ 120,00","contact_name":"Vaqueiro"}' | jq
```

Depois, abra a tela **WhatsApp → Validações** no frontend e clique em **Atualizar**.
O evento aparece como pendente.

> Observação: se o texto não trouxer `R$`, o campo `value_brl` fica ausente e o evento fica com `missing_fields` no payload (`payload.nlp.missing_fields`).
