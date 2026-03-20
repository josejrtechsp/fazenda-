# PATCH IDEAL Fazenda Front V4 FIX3C

## O que corrige
1) **Dashboard (Início/Mês)**: KPIs voltam a ser grid responsivo (não fica 1 coluna gigante).
2) **Mangas & Pasto**: adiciona alternância **Mapa/Lista**; Mapa = tiles compactos (mais visual).

## Como aplicar
```bash
unzip -o PATCH_IDEAL_FAZENDA_FRONT_STANDALONE_V4_FIX3C_KPI_GRID_PASTO_MAP.zip -d .
bash tools/verify_ideal_fazenda_front_standalone_v4_fix3c.sh
```

Depois reinicie o Vite (limpe cache):
```bash
cd frontend
rm -rf .vite
npm run dev
```
