# Sistema Fazenda Ideal

Sistema de gestão rural com foco em operação e gestão financeira da fazenda, cobrindo rebanho, custos e receitas, clima, máquinas, estoque, cadastros e dashboards gerenciais.

## Estado atual

Hoje o projeto já entrega uma base funcional para:

- financeiro com contas a pagar e a receber
- aprovação por alçada
- programação e conciliação de títulos
- fechamento mensal financeiro
- rebanho com cadastros, lotes, indicadores e importações
- dashboards operacionais e gerenciais
- fluxo local de front + back para desenvolvimento

## Stack

- Backend: FastAPI + SQLModel + SQLite
- Frontend: React + Vite
- Banco local: SQLite

## Estrutura do projeto

```text
IDEAL_FAZENDA/
├── backend/         # API, modelos, regras de negócio e banco
├── frontend/        # interface React/Vite
├── docs/            # documentação funcional e técnica
├── tools/           # scripts auxiliares e smoke tests
├── run_all.sh       # sobe backend e frontend
├── run_bg.sh        # sobe em background
├── stop_bg.sh       # derruba serviços em background
└── install_autostart.sh
```

## Como rodar localmente

Na raiz do projeto:

```bash
./run_all.sh setup-back
./run_all.sh setup-front
./run_all.sh all
```

URLs padrão:

- Frontend: `http://127.0.0.1:5173/#login`
- Backend health: `http://127.0.0.1:8001/health`
- Backend docs: `http://127.0.0.1:8001/docs`

### Comandos úteis

```bash
./run_all.sh back
./run_all.sh front
./run_all.sh kill
FRONT_MODE=preview ./run_all.sh all
./run_bg.sh
./stop_bg.sh
```

## Fluxo de desenvolvimento

Branch principal:

- `main`: base publicada no GitHub

Branch de trabalho atual:

- `codex/desenvolvimento-financeiro`

Fluxo recomendado:

1. atualizar a branch de trabalho
2. fazer as alterações
3. validar frontend e backend
4. commit pequeno e descritivo
5. push da branch
6. depois integrar em `main`

## Validação

### Backend

```bash
cd backend
.venv/bin/python -m compileall app
```

### Frontend

```bash
cd frontend
npm run build
```

### Smoke test financeiro

```bash
python3 tools/smoke_finance_approval_tiers.py
```

Documentação relacionada:

- `docs/SMOKE_FINANCE_APPROVAL_TIERS.md`

## Módulos principais

- Rebanho
- Mangas & Pasto
- Movimentações
- Estoque
- Custos & Receitas
- Máquinas
- Clima
- Planejamento
- Tarefas e Notificações
- WhatsApp / Validações

## Boas práticas deste repositório

- não subir banco local, cache, backup ou `node_modules`
- evitar trabalhar diretamente em `main`
- manter commits objetivos
- validar build antes de subir
- quando possível, registrar mudanças importantes em `docs/`

## Observações

- Como o projeto está em pasta sincronizada por iCloud, pode haver lentidão ou conflito em arquivos muito grandes ou temporários.
- Para desenvolvimento mais estável, vale considerar uma cópia local fora do iCloud no futuro.

## Próximos focos

- fechamento financeiro com governança mais forte
- dashboard financeiro mais analítico
- aprofundamento da ficha do animal
- guias rápidos em todas as telas
- integração mais consistente entre módulos
