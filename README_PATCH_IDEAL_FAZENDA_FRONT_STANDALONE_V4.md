# PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4

## O que entra
- Front conectado ao backend (`/producer/monthly-summary` e `/events`)
- Dashboard do produtor (Mês) agora lê dados reais do SQLite via API
- Transferências agora gravam e listam eventos `type=transfer`
- WhatsApp Validações lista eventos e permite aprovar/rejeitar (PATCH /events/{id})

## Variável de ambiente
Crie `frontend/.env` (ou use o `.env.example`) com:

```
VITE_API_BASE=http://localhost:8001
```

## Aplicar
```bash
cd "$PROJ"
unzip -o PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4_CONNECT_API.zip -d .
bash tools/verify_ideal_fazenda_front_standalone_v4.sh
```
