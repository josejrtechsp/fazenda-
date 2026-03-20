# PATCH IDEAL FAZENDA FRONT V9 — Rebanho puxando do backend (/herd)

## O que muda
- Atualiza `frontend/src/pages/Herd.jsx` para:
  - tentar carregar lotes via `GET /herd/lots`
  - tentar carregar animais via `GET /herd/animals?lot_id=...`
  - ter fallback automático para mocks (não quebra se o backend não tiver)
  - botão **Seed demo (rebanho)** que chama `POST /herd/seed-demo`

## Como aplicar
```bash
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V9_HERD_API.zip -d .
bash tools/verify_ideal_fazenda_front_v9_herd_api.sh
```
