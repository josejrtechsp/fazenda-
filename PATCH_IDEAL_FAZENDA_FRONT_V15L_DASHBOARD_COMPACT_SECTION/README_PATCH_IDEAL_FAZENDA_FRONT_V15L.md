# PATCH IDEAL Fazenda Front V15L — Compactar seção do Dashboard

Este patch deixa a **seção superior do Dashboard** (KPIs + Tendência + Top custos) menor e mais harmônica, sem mexer no restante do layout.

## Arquivos adicionados
- `frontend/src/styles/producer_dashboard_compact_v15l.css`

## Como aplicar
1) Descompacte o ZIP na raiz do projeto.
2) Rode o apply:

```bash
bash tools/apply_front_v15l_compact_section.sh
```

3) (Opcional) Verifique build:

```bash
bash tools/verify_ideal_fazenda_front_v15l.sh
```

4) Reinicie o Vite.
