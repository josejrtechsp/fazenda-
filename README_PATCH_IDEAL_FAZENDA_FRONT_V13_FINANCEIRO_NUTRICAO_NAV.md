# IDEAL FAZENDA — Front V13 (Financeiro + Nav Nutrição)

## O que esse patch faz

1) **Habilita os menus** do sidebar:
- **Nutrição** (`feed`) passa a abrir a tela **Catálogo + Compras de Nutrição**.
- **Financeiro** (`finance`) passa a abrir uma tela **Registrar Saída (venda/abate) + Resumo do mês**.

2) No **Dashboard do Produtor** (`home`), os botões de “ações rápidas” deixam de ser `alert()` e **navegam de verdade**:
- Registrar venda/saída → Financeiro
- Lançar custo → Nutrição
- Registrar pesagem → Rebanho (por enquanto)
- Transferir lote/animal → Movimentações

## Como aplicar

Na raiz do projeto (onde existe `frontend/` e `tools/`):

```bash
PROJ="$HOME/Library/Mobile Documents/com~apple~CloudDocs/SOFTWARE FAZENDA/IDEAL_FAZENDA"
cd "$PROJ" || exit 1

# mover patch para dentro do projeto (se estiver em Downloads)
mv "$HOME/Downloads/PATCH_IDEAL_FAZENDA_FRONT_V13_FINANCEIRO_NUTRICAO_NAV.zip" "$PROJ/" 2>/dev/null || true

# aplicar
unzip -o "PATCH_IDEAL_FAZENDA_FRONT_V13_FINANCEIRO_NUTRICAO_NAV.zip" -d .

# verificar
bash tools/verify_ideal_fazenda_front_v13_financeiro_nutricao_nav.sh

# reiniciar front (opcional, mas recomendado)
cd "$PROJ/frontend"
rm -rf .vite
npm run dev
