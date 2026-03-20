# PATCH — IDEAL Fazenda FRONT V6 (WhatsApp Validações + Simulador)

Este patch melhora a tela **WhatsApp → Validações**:

- Mostra avisos de `missing_fields` e `ambiguities` (vindos de `payload.nlp`)
- Adiciona botão **Simular mensagem** (cria evento pendente via `POST /whatsapp/ingest`)

## Como aplicar

Na raiz do projeto:

```bash
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V6_WHATSAPP_VALIDATIONS_SIMULATOR.zip -d .
bash tools/verify_ideal_fazenda_front_v6_whatsapp_validations.sh
```

Depois, rode o frontend normalmente:

```bash
cd frontend
npm run dev
```

> Para o simulador funcionar, aplique também o patch do backend WhatsApp NLP (V3) e rode o backend em `http://localhost:8001`.
