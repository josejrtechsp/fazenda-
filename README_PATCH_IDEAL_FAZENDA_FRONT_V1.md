# PATCH IDEAL FAZENDA FRONT V1 (UI base CRAS)

Este patch adiciona o **módulo IDEAL Fazenda** no frontend, seguindo **100% o layout/estilo do CRAS** (cras_ui_v2 + actions apple).

## O que entra neste patch
- Novo módulo **FAZENDA** no AppShell (`/app?mod=fazenda`)
- **Shell completo** no padrão CRAS (TopHeader + Sidebar v2 + PageHeader v2)
- Tela **Início (Modo Produtor / Mês)** com:
  - 5 KPIs (inclui **Custo sempre em R$/@**)
  - 2 blocos visuais (tendência 6 meses e Top 5 custos) — mock
  - Resumo em português claro + alertas — mock
- Tela **WhatsApp (Validações)** com:
  - abas Pendentes/Ambíguos/Aprovados/Rejeitados/Todos
  - card com transcrição, tags, resolução de ambiguidade (1 clique) — mock

## Como acessar
- Login direto do módulo: `http://SEU_HOST/login?mod=fazenda`
- Ou após logar: `http://SEU_HOST/app?mod=fazenda`

## Instalação (macOS)
> Assumindo que você aplica patches em `~/POPNEWS1` e guarda os zips em `~/POPNEWS1/MÓDULOS`.

```bash
cd ~/POPNEWS1
unzip -o "MÓDULOS/PATCH_IDEAL_FAZENDA_FRONT_V1.zip" -d .

bash tools/verify_ideal_fazenda_front_v1.sh
```

## Teste rápido
1) Suba o frontend como você já faz.
2) Abra no navegador: `/login?mod=fazenda`
3) Faça login e confirme que abre o módulo com:
   - sidebar "FAZENDA"
   - Início com 5 cards e custo em **R$/@**
   - WhatsApp (Validações) com aba **Ambíguos**

## Observações
- Dados ainda estão em **mock** (UI-first). Integração com backend/WhatsApp entra nos próximos patches.
