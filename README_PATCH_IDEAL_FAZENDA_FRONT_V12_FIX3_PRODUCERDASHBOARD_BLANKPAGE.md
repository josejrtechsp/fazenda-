# PATCH — IDEAL Fazenda Front V12 FIX3 (página em branco no Dashboard)

## O que corrige

- Corrige **página em branco** na tela **Início / Resumo do mês**.
- A causa era um `ReferenceError` por função ausente (`normalizeLabel`) usada no cálculo de **Top custos**.

## Como aplicar

Na raiz do projeto `IDEAL_FAZENDA`:

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ" || exit 1

# mover o zip (se estiver em Downloads)
mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V12_FIX3_PRODUCERDASHBOARD_BLANKPAGE.zip" "$PROJ/" 2>/dev/null || true

# aplicar
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V12_FIX3_PRODUCERDASHBOARD_BLANKPAGE.zip" -d .

# verificar
bash tools/verify_ideal_fazenda_front_v12_fix3_producer_dashboard.sh

# reiniciar o front
cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```

## Teste rápido

Abra o link do Vite e verifique se o Dashboard renderiza.
Se ainda ficar em branco, abra o console do navegador (F12) e copie o erro.
