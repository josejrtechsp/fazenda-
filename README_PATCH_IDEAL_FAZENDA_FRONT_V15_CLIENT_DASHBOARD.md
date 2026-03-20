# PATCH IDEAL FAZENDA FRONT V15 — Dashboard Cliente + Marca (Tagline)

## Objetivo
- Dashboard inicial **mais detalhado e mais estiloso** (client-ready), mantendo o padrão clean.
- Corrigir a percepção de **logo desfocado** com CSS de nitidez.
- Inserir texto ao lado do logo, em **degradê roxo→verde**:
  **IDEAL - SOLUÇÕES PARA PECUÁRIA**

## Como aplicar
Dentro da raiz do projeto `IDEAL_FAZENDA` (onde existem `frontend/` e `tools/`):

```bash
# 1) aplicar patch
unzip -o PATCH_IDEAL_FAZENDA_FRONT_V15_CLIENT_DASHBOARD.zip -d .

# 2) aplicar ajustes de marca no cabeçalho
bash tools/apply_ideal_fazenda_front_v15_brand_lockup.sh

# 3) verificar (build)
bash tools/verify_ideal_fazenda_front_v15_client_dashboard.sh

# 4) subir
cd frontend
npm run dev -- --port 5174
```

> Se você já estiver usando 5174, ajuste a porta.

## O que muda
- `frontend/src/pages/ProducerDashboard.jsx` (novo layout “cliente-ready”)
- `frontend/src/styles/producer_dashboard_client.css` (estilo do dashboard, escopado)
- `frontend/src/styles/ideal_brand_lockup.css` (tagline e nitidez do logo)
- `tools/apply_ideal_fazenda_front_v15_brand_lockup.sh` (injeta tagline no componente do cabeçalho)
- `tools/verify_ideal_fazenda_front_v15_client_dashboard.sh` (npm run build)
