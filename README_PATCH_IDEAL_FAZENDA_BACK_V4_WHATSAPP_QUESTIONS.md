# PATCH IDEAL FAZENDA BACK V4 — WhatsApp follow-up (perguntas + envio opcional)

## O que muda
Adiciona endpoints no router `/whatsapp`:

1) `GET /whatsapp/questions/{event_id}`
- Retorna perguntas (baseadas em `payload.nlp.missing_fields`/`ambiguities`)
- Retorna também um `recommended_message` pronto para copiar e colar

2) `POST /whatsapp/send`
- Envia mensagem via WhatsApp Cloud API (Meta)
- Requer env: `WA_ACCESS_TOKEN` e `WA_PHONE_NUMBER_ID`

3) `POST /whatsapp/send-for-event/{event_id}`
- Envia follow-up para o contato do evento (`payload.meta.contact_phone`)
- Usa `message` do body, ou gera automaticamente a partir das perguntas

## Aplicar
- Descompacte o zip na raiz do projeto (IDEAL_FAZENDA)
- Rode:
  bash tools/verify_ideal_fazenda_back_v4_whatsapp_questions.sh

## Variáveis de ambiente (opcional)
- WA_ACCESS_TOKEN="..."
- WA_PHONE_NUMBER_ID="..."

Sem essas envs, os endpoints de envio retornam erro (mas o endpoint de perguntas funciona).
