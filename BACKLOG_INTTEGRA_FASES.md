# Backlog de Fechamento com Inttegra

Data base: 10/02/2026  
Cobertura atual estimada: **22%**  
Gap restante estimado: **78%**

## Revisão técnica posterior
Leitura revisada após auditoria do código em execução:
- Cobertura visível de produto: **~60%**
- Prontidão operacional confiável: **~40% a 45%**
- O principal gap atual não é mais "falta de tela", e sim **integração incompleta entre frontend, backend montado e fonte única de verdade**.

Referência complementar:
- `PLANO_EXECUCAO_FECHAMENTO.md`

## Objetivo
Fechar o gap funcional do sistema para ficar alinhado ao escopo dos documentos:
- `PASSO A PASSO - SISTEMA INTTEGRA - CLIENTE.pdf`
- `PLANO DE CONTAS - INTTEGRA.pdf`

Meta: sair de 22% para **85%+** de aderência funcional.

## Status de execução (10/02/2026)
- [x] Fase 1 - Item 1 (backend): estrutura de plano de contas N1-N4 + seed Inttegra + endpoints.
- [x] Fase 1 - Item 2 (backend): cadastro de pessoas (cliente/fornecedor/colaborador/transportadora/proprietário) com CRUD e filtros.
- [x] Fase 1 - Item 3 (v1): acoplado plano de contas + pessoas aos lançamentos de receitas/despesas (backend validado + frontend com aba Lançamentos).
- [ ] Próximo em andamento: consolidar tela de contas a pagar/receber com fluxo de quitação/recebimento por competência.

## Priorização
Ordem de valor para operação da fazenda:
1. Financeiro estruturado (plano de contas + pessoas + contas a pagar/receber)
2. Pecuária completa (movimentações e efetivo)
3. Estoque completo (cadastro + movimentações com regra de pago)
4. Rotina operacional (tarefas/notificações/painéis)
5. Módulos de gestão avançada (planejamento, DISC, mapa cultural, metas)

---

## Fase 1 (Alta prioridade) - Base operacional e financeira
Prazo sugerido: 3 a 4 semanas

### 1) Plano de contas Inttegra (N1-N4)
- Backend:
  - Criar tabelas: `accounts_level1`, `accounts_level2`, `accounts_level3`, `accounts_level4` (ou estrutura única hierárquica).
  - Seed inicial com o plano do PDF.
  - Endpoint de consulta hierárquica para frontend.
- Frontend:
  - Seletor hierárquico (expandível) em receitas/despesas.
  - Filtro por nível/conta nos relatórios.
- Aceite:
  - Usuário consegue lançar receita/despesa com conta nível 4.
  - Relatórios exibem agregação por nível 1/2/3/4.

### 2) Financeiro - Cadastros de Pessoas (cliente/fornecedor/etc.)
- Backend:
  - CRUD de pessoas com tipos: colaborador, fornecedor, cliente, transportadora, proprietário.
- Frontend:
  - Tela de cadastro/edição/listagem de pessoas.
  - Vínculo obrigatório com cliente (receita) e fornecedor (despesa).
- Aceite:
  - Não permite salvar receita sem cliente.
  - Não permite salvar despesa sem fornecedor.

### 3) Financeiro - Movimentações completas
- Backend:
  - Receita e despesa com status `open/paid/received/overdue`.
  - Campo de competência e campo de pagamento/recebimento.
- Frontend:
  - Formulários completos de receita/despesa.
  - Fluxo claro de contas a pagar e contas a receber.
- Aceite:
  - Contas abertas aparecem em “a pagar/a receber”.
  - Ao quitar/receber, atualiza fluxo e DRE corretamente.

### 4) Pecuária - Movimentações faltantes
- Itens:
  - Entradas (nascimento, compra, transferência entrada, estoque de partida)
  - Saídas (abate, venda em pé, transferência saída, morte, consumo, doação)
  - Desmames
  - Confinamento/semiconfinamento/TIP/RIP
- Aceite:
  - Toda movimentação gera evento auditável e impacta efetivo do rebanho.

### 5) Efetivo pecuário e áreas mensais
- Itens:
  - Estoque pecuário mensal por categoria + peso médio
  - Área produtiva mensal (pastagem, ILP, volumoso, reforma/alagada)
- Aceite:
  - Fechamento mensal reflete efetivo e área por competência.

### 6) Estoque - regra “somente insumo pago”
- Itens:
  - Cadastro de produto com flags: `insumo`, `formador_estoque`.
  - Movimentação trimestral com bloqueio para itens não pagos.
- Aceite:
  - Itens não pagos não entram na variação de estoque operacional.

---

## Fase 2 (Média prioridade) - Gestão e operação ampliada
Prazo sugerido: 2 a 3 semanas

### 1) Módulo Máquinas
- Cadastros (máquinas/implementos) + movimentações.
- Custos associados (combustível, manutenção, seguros/impostos/multas).

### 2) Módulo Clima
- Lançamento mensal de mm de chuva.
- Série histórica por propriedade/área.

### 3) Rotinas gerenciais
- Tarefas com responsável, prazo, status e notificação.
- Rotinas semanal/mensal/trimestral/anual.

### 4) Painel de consultas
- Relatórios por módulo.
- Fechamento trimestral/semestral exportável (CSV/PDF).

### 5) Notificações
- Central de notificações no topo.
- Eventos de tarefa e pendências críticas.

---

## Fase 3 (Média/baixa prioridade) - Planejamento e experiência
Prazo sugerido: 2 semanas

### 1) Planejamento fazenda
- DISC (questionário + resultado)
- Mapa cultural (questionário + gráfico)
- Metas (cadastro + acompanhamento trimestral/safra)

### 2) Navegação e produtividade
- Pesquisa global de módulos
- Favoritos
- Recentes

### 3) App e integrações
- Ajustes de fluxo para uso móvel
- Consolidação de integração WhatsApp para operação de campo

---

## Arquitetura técnica recomendada (ordem de execução)
1. Modelo de dados e migrations
2. Endpoints backend e testes
3. Formulários e telas frontend
4. Relatórios e agregações
5. Polimento UX e validações de negócio

---

## Definição de pronto (DoD)
- Regra de negócio coberta por validação frontend + backend.
- Persistência em banco com migrations versionadas.
- Relatório refletindo corretamente os lançamentos do módulo.
- Teste funcional manual com cenário real da fazenda.
- Sem regressão de tela atual (rebanho, financeiro, estoque, WhatsApp).

---

## Próximo passo imediato (execução)
Sprint atual:
1. Implementar estrutura de plano de contas N1-N4 no backend.
2. Criar CRUD de pessoas.
3. Acoplar ambos aos formulários de receitas/despesas.
4. Entregar primeira versão navegável para validação tua.
