# PATCH — IDEAL FAZENDA FRONT V13 FIX1

**Problema**

Após aplicar o `PATCH_IDEAL_FAZENDA_FRONT_V13_FINANCEIRO_NUTRICAO_NAV.zip`, o Vite falha com:

> Failed to resolve import "./pages/NutricaoComprasItens.jsx" from "src/FazendaApp.jsx"

Isso acontece porque o patch V13 adicionou o import/rota, mas o arquivo da página não foi incluído.

**O que este FIX faz**

- Adiciona `frontend/src/pages/NutricaoComprasItens.jsx` (página de nutrição: itens + compras)
- Adiciona `frontend/src/styles/nutricao_admin.css`
- Inclui um verificador: `tools/verify_ideal_fazenda_front_v13_fix1_nutricao_page.sh`

Obs.: a página importa o CSS diretamente (não depende do `FazendaApp.jsx` importar).

## Como aplicar

No terminal, dentro da pasta do projeto `IDEAL_FAZENDA`:

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ" || exit 1

unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V13_FIX1_NUTRICAO_PAGE.zip" -d .

bash tools/verify_ideal_fazenda_front_v13_fix1_nutricao_page.sh

cd "$PROJ/frontend"
rm -rf .vite
npm run dev
```
