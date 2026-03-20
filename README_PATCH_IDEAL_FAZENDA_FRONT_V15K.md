# PATCH IDEAL FAZENDA FRONT V15K — Harmony fine tuning

Este patch aplica micro-ajustes (gap/padding/alinhamento) no cabeçalho e dashboard, mantendo as reduções do V15J.

## Aplicação

1. Descompacte o ZIP na raiz do projeto IDEAL_FAZENDA
2. Rode:

```bash
bash tools/verify_ideal_fazenda_front_v15k.sh
```

3. Suba o front:

```bash
cd frontend
rm -rf .vite
npm run dev -- --port 5174
```
