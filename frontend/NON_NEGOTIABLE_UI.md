# UI Inegociavel

Este projeto possui duas areas visuais inegociaveis no sistema:

- Cabecalho do sistema (FazendaTopHeader)
- Barra lateral com abas (CrasSidebarNav)

## Travas tecnicas

- Escopo de sistema: `src/FazendaApp.jsx` usa `cras-ui-v2 fazenda-system-shell`.
- CSS de blindagem: `src/styles/ui_nonnegotiable_lock.css`.
- Ordem de carga: `src/main.jsx` importa `ui_nonnegotiable_lock.css` por ultimo.
- Verificacao automatica: `npm run verify:ui-lock`.

## Regra de manutencao

- Nao alterar classes estruturais:
  - `app-header app-header-fazenda`
  - `app-header-inner app-header-inner-fazenda`
  - `cras-shell-v2`
  - `cras-sidebar-v2`
  - `cras-sidebar-v2-item`
  - `cras-sidebar-v2-nav`
- Qualquer ajuste futuro deve manter a aparencia e o comportamento atuais.
