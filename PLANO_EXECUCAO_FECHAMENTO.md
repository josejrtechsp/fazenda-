# Plano de Execução de Fechamento

Data base: 10/02/2026
Projeto auditado: `IDEAL_FAZENDA`

## Resumo executivo
O sistema já passou da fase de mockup. Há base real de operação em rebanho, movimentações, estoque, financeiro e WhatsApp. O problema atual é estrutural: parte relevante do que já existe no frontend não está exposta pelo backend principal, e parte do que aparece em tela ainda usa `localStorage` como fonte principal.

Leitura honesta do estado atual:
- Cobertura visível do produto: `~60%`
- Prontidão operacional confiável: `~40% a 45%`
- Meta recomendada de curto prazo: levar o sistema para `~65%` de prontidão confiável em 7 dias e `~75% a 80%` em 21 dias.

## Diagnóstico crítico
### 1. Integração incompleta
Há routers relevantes escritos no backend que não entram no app principal:
- `backend/app/routers/finance_titles.py`
- `backend/app/routers/bank_accounts.py`
- `backend/app/routers/cost_centers.py`
- `backend/app/routers/payment_methods.py`
- `backend/app/routers/supplier_catalog.py`
- `backend/app/routers/operations.py`
- `backend/app/routers/reports.py`

Hoje o `backend/app/main.py` monta apenas:
- `health`
- `events`
- `whatsapp`
- `producer`
- `herd`
- `nutrition`
- `accounts`
- `people`

Impacto:
- o frontend já chama rotas que tendem a responder `404`
- o sistema parece mais pronto do que realmente está

### 2. Fonte de verdade duplicada
O rebanho e partes do dashboard ainda usam `localStorage` como base principal:
- `frontend/src/pages/Herd.jsx`
- `frontend/src/pages/ProducerDashboard.jsx`

Impacto:
- risco de divergência entre número exibido e número persistido
- dashboards gerenciais perdem credibilidade

### 3. Navegação expõe módulo incompleto
A navegação principal ainda exibe itens que não têm fechamento real no app.

Caso concreto:
- `Sanidade` aparece no menu em `frontend/src/FazendaApp.jsx`
- não existe `case "health"` no fluxo principal de renderização

Impacto:
- tela morta
- percepção de sistema improvisado

### 4. Financeiro avançado está pela metade
O frontend já tem fluxo para:
- contas a pagar
- contas a receber
- quitação
- recebimento
- aprovação
- agendamento
- conciliação
- fechamento mensal

Mas esse fluxo depende de routers que ainda não estão montados no backend principal.

### 5. Arquitetura ainda está em modo protótipo forte
Há consistência suficiente para desenvolver e validar, mas ainda falta:
- fonte única de verdade
- ativação completa dos módulos já escritos
- endurecimento de regras de negócio
- migração versionada e governança mínima

## Nota por módulo
- Visão geral / dashboard: `6/10`
- Rebanho: `6/10`
- Movimentações: `6/10`
- Estoque: `5/10`
- Nutrição: `6/10`
- Financeiro: `5,5/10`
- Cadastros financeiros: `5/10`
- WhatsApp: `7/10`
- Máquinas / clima / tarefas / planejamento / notificações: `3/10`
- Arquitetura e confiabilidade: `4/10`

## Ordem correta de execução
1. Ativar backend que já existe.
2. Unificar fonte de verdade de dados.
3. Fechar financeiro ponta a ponta.
4. Ajustar navegação real para esconder o que não está pronto e ligar o que já está pronto.
5. Entrar em pacote de confiabilidade.
6. Fazer polimento final de UX.

## Sprint de 7 dias
Objetivo: tirar o sistema da zona de "produto com aparência pronta" e levar para "operação básica confiável".

### Bloco 1. Ativação do backend já escrito
Arquivos-alvo:
- `backend/app/main.py`
- `backend/app/routers/finance_titles.py`
- `backend/app/routers/bank_accounts.py`
- `backend/app/routers/cost_centers.py`
- `backend/app/routers/payment_methods.py`
- `backend/app/routers/supplier_catalog.py`
- `backend/app/routers/operations.py`
- `backend/app/routers/reports.py`

Entrega:
- incluir no app principal todos os routers já consumidos pelo frontend
- validar prefixos, tags e conflito de rota
- rodar smoke tests manuais para os endpoints críticos

Aceite:
- frontend financeiro deixa de falhar por rota ausente
- cadastros financeiros conseguem carregar listas básicas

### Bloco 2. Fechamento do financeiro mínimo operacional
Arquivos-alvo:
- `frontend/src/pages/Financeiro.jsx`
- `frontend/src/pages/FinanceiroCadastros.jsx`
- `backend/app/routers/finance_titles.py`
- `backend/app/routers/accounts.py`
- `backend/app/routers/people.py`

Entrega:
- contas a pagar funcionando
- contas a receber funcionando
- quitação e recebimento funcionando
- conciliação simples funcionando
- fechamento mensal básico sem arrastar lançamento indevido

Aceite:
- consegue lançar, aprovar, pagar e receber
- fluxo de caixa reflete o movimento do mês corretamente

### Bloco 3. Unificação de rebanho e dashboard
Arquivos-alvo:
- `frontend/src/pages/Herd.jsx`
- `frontend/src/pages/ProducerDashboard.jsx`
- `backend/app/routers/herd.py`
- `backend/app/routers/producer.py`

Entrega:
- tirar `localStorage` como fonte principal do rebanho
- usar backend como base canônica
- ajustar dashboard para ler os mesmos dados do backend

Aceite:
- total de cabeças, categorias, prenhez e arrobas batem entre rebanho e dashboard

### Bloco 4. Limpeza da navegação
Arquivos-alvo:
- `frontend/src/FazendaApp.jsx`
- `frontend/src/components/CrasSidebarNav.jsx`

Entrega:
- esconder itens mortos
- ligar módulos prontos que já existem
- remover duplicidade e ruído da sidebar

Aceite:
- nenhum item de menu relevante leva para fallback genérico

### Bloco 5. Cenários de validação
Entrega:
- cenário 1: compra de insumo -> financeiro -> estoque -> dashboard
- cenário 2: movimentação de lote -> rebanho -> áreas -> dashboard
- cenário 3: lançamento de despesa RH -> desembolso por cabeça -> alerta de limite

Aceite:
- cenário completo funciona sem edição manual de banco

## Sprint de 21 dias
Objetivo: levar o sistema para operação assistida de verdade.

### Bloco 1. Financeiro completo
Arquivos-alvo principais:
- `frontend/src/pages/Financeiro.jsx`
- `frontend/src/pages/FinanceiroCadastros.jsx`
- `backend/app/routers/finance_titles.py`
- `backend/app/routers/cost_centers.py`
- `backend/app/routers/bank_accounts.py`
- `backend/app/routers/payment_methods.py`
- `backend/app/routers/reports.py`

Entrega:
- competência x caixa fechado
- aprovação consolidada
- RH consolidado por centro de custo
- DRE consistente
- fluxo de caixa consistente
- desembolso por cabeça sem investimento
- regra de alerta acima de R$ 90/cabeça aplicada corretamente

### Bloco 2. Estoque operacional real
Arquivos-alvo principais:
- `frontend/src/pages/EstoqueFarmacia.jsx`
- `frontend/src/pages/EstoqueSemenEmbrioes.jsx`
- `frontend/src/pages/EstoqueNutricional.jsx`
- `frontend/src/pages/EstoqueBase.jsx`
- `backend/app/routers/nutrition.py`
- `backend/app/routers/events.py`

Entrega:
- entrada
- saída
- saldo
- alerta
- valor em estoque
- vínculo com compra e uso
- bloqueio de saldo negativo silencioso

### Bloco 3. WhatsApp operacional do vaqueiro
Arquivos-alvo principais:
- `backend/app/routers/whatsapp.py`
- `frontend/src/pages/WhatsAppValidations.jsx`
- `backend/app/routers/operations.py`
- `backend/app/routers/herd.py`
- `backend/app/routers/nutrition.py`

Entrega:
- mensagens do vaqueiro entram como operação validável
- ambiguidades viram pendência
- movimentação, nutrição e registros simples são persistidos com rastreio

### Bloco 4. Rebanho executivo
Arquivos-alvo principais:
- `frontend/src/pages/Herd.jsx`
- `frontend/src/pages/ProducerDashboard.jsx`
- `backend/app/routers/herd.py`
- `backend/app/routers/producer.py`

Entrega:
- abrir rebanho no dashboard consolidado
- visão rápida de cabeças
- tipo de gado
- prenhez
- vazias
- lotes
- peso vivo
- arrobas
- alertas sanitários e operacionais

### Bloco 5. Governança mínima
Arquivos-alvo principais:
- `backend/app/db/session.py`
- camada de modelos e routers financeiros/operacionais

Entrega:
- trilha de auditoria mínima
- regras básicas por perfil
- preparação para migração versionada

## O que não fazer agora
- Não fazer polimento visual amplo antes de fechar backend e fonte de verdade.
- Não abrir novos módulos grandes antes de terminar financeiro e rebanho.
- Não deixar menu de produção apontando para tela parcial.

## Definição de pronto da fase atual
- Nenhuma tela principal depende de rota ausente.
- Rebanho e dashboard batem número com backend.
- Financeiro permite lançar, pagar, receber e fechar mês.
- Estoque não aceita inconsistência silenciosa.
- WhatsApp entra no fluxo operacional com validação.
- Navegação não expõe módulo morto.

## Próximo passo técnico recomendado
Sequência exata de implementação:
1. `backend/app/main.py`
2. `frontend/src/pages/Financeiro.jsx`
3. `frontend/src/pages/FinanceiroCadastros.jsx`
4. `frontend/src/pages/Herd.jsx`
5. `frontend/src/pages/ProducerDashboard.jsx`
6. `frontend/src/FazendaApp.jsx`

Essa é a ordem que mais reduz risco com menor retrabalho.
