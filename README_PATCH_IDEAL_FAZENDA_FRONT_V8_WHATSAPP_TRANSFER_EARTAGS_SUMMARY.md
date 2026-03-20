# IDEAL Fazenda — Patch FRONT V8

## O que entra

### 1) WhatsApp → Transferência por **Brincos/IDs**
Na tela **WhatsApp → Validações**, ao resolver um evento do tipo **Transferência**, você pode escolher:
- **Cabeças (quantidade)** (modo antigo)
- **Brincos/IDs (individual)**: cola uma lista (um por linha, ou separado por espaço/vírgula)

O sistema calcula o total detectado e salva em `payload.ear_tags[]`...

### 2) Copiar resumo do mês para WhatsApp
No dashboard **Resumo do mês**, entra o botão **"Copiar resumo WhatsApp"**.
Ele chama o endpoint:
- `GET /producer/monthly-summary-text?month=YYYY-MM`

e copia o texto pronto para colar no WhatsApp.

### 3) Perguntas (follow-up) pelo backend
No card de cada evento pendente/ambíguo, o botão de perguntas passa a tentar:
- `GET /whatsapp/questions/{id}`

Se o endpoint não existir (ou falhar), usa fallback local.

## Como aplicar

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ"

mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V8_WHATSAPP_TRANSFER_EARTAGS_SUMMARY.zip" "$PROJ/" 2>/dev/null || true
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V8_WHATSAPP_TRANSFER_EARTAGS_SUMMARY.zip" -d .

bash tools/verify_ideal_fazenda_front_v8_whatsapp_transfer.sh

cd "$PROJ/frontend"
npm run dev
```

