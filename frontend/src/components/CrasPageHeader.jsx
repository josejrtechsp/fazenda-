import React, { useEffect, useMemo, useState } from "react";

/**
 * CrasPageHeader (UI v2)
 * - bloco leve, sem ficar "gigante"
 * - subtelas (botões) OU chips de contexto
 * - guia rápido (ajuda contextual) recolhível
 * - ações à direita (opcional)
 */
export default function CrasPageHeader({
  eyebrow = "Você está em",
  title = "CRAS",
  subtitle = "",
  // legado: lista de chips (strings)
  bullets = [],
  // novo: subtelas clicáveis
  subtabs = [],
  activeSubtabKey = "",
  onSubtab = () => {},
  // novo: ajuda contextual (depende da subtela ativa)
  help = null,
  // ações
  actions = [],
  onAction = () => {},
}) {
  const hasSubtabs = Array.isArray(subtabs) && subtabs.length > 0;
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;

  const [helpOpen, setHelpOpen] = useState(false);

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const effectiveActiveKey = useMemo(() => {
    if (activeSubtabKey) return activeSubtabKey;
    if (hasSubtabs) return subtabs[0]?.key || subtabs[0]?.label || "";
    return "";
  }, [activeSubtabKey, hasSubtabs, subtabs]);

  const activeSubtabLabel = useMemo(() => {
    if (hasSubtabs) {
      const t = subtabs.find((x) => (x.key || x.label) === effectiveActiveKey);
      return t?.label || "";
    }
    // fallback: alguns tabs antigos usam chips (não clicáveis). Usamos o primeiro para gerar ajuda geral.
    if (hasBullets) return bullets[0] || "";
    return "";
  }, [hasSubtabs, subtabs, effectiveActiveKey, hasBullets, bullets]);

  // DERIVED_HELP_V1 — fallback para telas ainda sem TAB_HELP no CrasApp
  const derivedHelp = useMemo(() => {
    const tKey = norm(title);

    const H = {
      tarefas: {
        "por tecnico": {
          title: "Guia rápido",
          summary: "Veja a fila de tarefas por responsável técnico.",
          what: "Esta visão organiza a rotina da equipe. Você escolhe um técnico e acompanha as tarefas em aberto e vencidas.",
          steps: [
            "Selecione um técnico para carregar a fila.",
            "Abra a tarefa para ver detalhes e prazo.",
            "Conclua a tarefa quando finalizar o atendimento/ação.",
          ],
          after: "Tarefas concluídas melhoram o SLA e deixam a gestão mais clara (sem retrabalho).",
        },
        vencidas: {
          title: "Guia rápido",
          summary: "Encontre rapidamente o que está fora do prazo.",
          what: "Mostra somente as tarefas vencidas para você priorizar o que é mais urgente.",
          steps: [
            "Revise a lista de vencidas e ordene por prazo/criticidade.",
            "Registre andamento ou ajuste responsável quando necessário.",
            "Conclua assim que resolver e mantenha a fila limpa.",
          ],
          after: "Reduz risco operacional e evita pendências acumuladas.",
        },
        metas: {
          title: "Guia rápido",
          summary: "Acompanhe metas e atividades recorrentes.",
          what: "Ajuda a equipe a manter rotinas (PAIF, visitas, retornos) com prazos e responsáveis.",
          steps: [
            "Confira as metas ativas e seus prazos.",
            "Planeje a semana distribuindo responsáveis.",
            "Atualize status para não perder prazos.",
          ],
          after: "Você ganha previsibilidade e melhora a execução do plano de trabalho.",
        },
        "concluir em lote": {
          title: "Guia rápido",
          summary: "Feche várias tarefas de uma vez (com segurança).",
          what: "Permite selecionar tarefas e concluir em lote para ganhar velocidade em rotinas repetitivas.",
          steps: [
            "Selecione as tarefas concluídas.",
            "Confira se não ficou nada pendente.",
            "Clique em concluir para fechar em lote.",
          ],
          after: "Economiza tempo e padroniza encerramento de rotinas.",
        },
        _default: {
          title: "Guia rápido",
          summary: "Organize o trabalho da equipe por prazos (SLA).",
          what: "Tarefas ajudam a não perder prazos e manter a rotina do CRAS sob controle.",
          steps: ["Use as subtelas para filtrar a lista.", "Conclua tarefas ao finalizar.", "Revise vencidas diariamente."],
          after: "Menos retrabalho e mais clareza na operação.",
        },
      },

      encaminhamentos: {
        filtros: {
          title: "Guia rápido",
          summary: "Refine a lista por status, prazo e destino.",
          what: "Filtros ajudam a localizar encaminhamentos rapidamente (inclusive os sem devolutiva).",
          steps: [
            "Ajuste período/status/destino.",
            "Aplique os filtros e revise a lista.",
            "Use a lista filtrada para cobrar devolutivas.",
          ],
          after: "Você encontra gargalos e melhora o acompanhamento entre serviços.",
        },
        novo: {
          title: "Guia rápido",
          summary: "Crie um encaminhamento padronizado em poucos passos.",
          what: "Aqui você registra destino, motivo, prioridade e prazos para gerar rastreabilidade.",
          steps: [
            "Escolha o usuário/família e o destino.",
            "Descreva a demanda e anexos, se houver.",
            "Envie e acompanhe o status até a devolutiva.",
          ],
          after: "Encaminhamentos bem registrados reduzem perda de informação e facilitam contrarreferência.",
        },
        "sem devolutiva": {
          title: "Guia rápido",
          summary: "Veja o que foi enviado e não voltou (controle de prazo).",
          what: "Mostra encaminhamentos sem resposta para você cobrar devolutiva dentro do prazo.",
          steps: [
            "Revise a lista e identifique os mais antigos.",
            "Cobre devolutiva ou reencaminhe se necessário.",
            "Registre a atualização para manter histórico.",
          ],
          after: "Evita encaminhamento 'perdido' e melhora a rede.",
        },
        "encaminhamento suas": {
          title: "Guia rápido",
          summary: "Encaminhamentos internos do SUAS (rede integrada).",
          what: "Use quando o destino é outro serviço SUAS (CRAS/CREAS/PopRua) com rastreio de prazos.",
          steps: [
            "Selecione o serviço de destino SUAS.",
            "Informe motivo e prioridade.",
            "Acompanhe recebimento e contrarreferência.",
          ],
          after: "Fortalece o fluxo em rede e melhora evidências do atendimento.",
        },
        todos: {
          title: "Guia rápido",
          summary: "Lista completa para consulta e auditoria.",
          what: "Mostra todos os encaminhamentos, com status e prazos, para operação e prestação de contas.",
          steps: ["Use busca e filtros para localizar.", "Abra o item para ver histórico.", "Registre devolutiva quando receber."],
          after: "Garante rastreabilidade e facilita gestão.",
        },
        _default: {
          title: "Guia rápido",
          summary: "Envio, recebimento e prazos na rede (CRAS/CREAS/PopRua).",
          what: "Encaminhamentos registram a comunicação entre serviços e evitam perda de informação.",
          steps: ["Crie pelo 'Novo'.", "Acompanhe 'Sem devolutiva'.", "Use 'Todos' para auditoria."],
          after: "Menos ruído e mais eficiência entre serviços.",
        },
      },

      casos: {
        "criar caso": {
          title: "Guia rápido",
          summary: "Abra um caso e comece o acompanhamento (SLA).",
          what: "Criar caso inicia a linha do metrô (etapas) e permite registrar evidências e ações.",
          steps: [
            "Selecione a família/pessoa e preencha observações iniciais.",
            "Crie o caso e valide status/prioridade.",
            "Depois opere pela lista para registrar etapa/evidência.",
          ],
          after: "Você garante continuidade do atendimento e rastreabilidade.",
        },
        filtros: {
          title: "Guia rápido",
          summary: "Encontre rapidamente o caso certo.",
          what: "Filtros ajudam a priorizar por status, risco, etapa e técnico.",
          steps: [
            "Escolha status/etapa e use busca por nome/CPF.",
            "Aplique e selecione o caso.",
            "Registre ações e evidências no detalhe.",
          ],
          after: "Você reduz tempo de busca e mantém operação mais fluida.",
        },
        "lista de casos": {
          title: "Guia rápido",
          summary: "Operação do dia a dia: lista + detalhe.",
          what: "Nesta visão você trabalha: seleciona um caso e executa etapas, evidências e contrarreferência.",
          steps: [
            "Selecione o caso na lista.",
            "Atualize a etapa na linha do metrô (SLA).",
            "Registre evidências e encaminhamentos relacionados.",
          ],
          after: "O caso fica completo e auditável (e melhora o histórico do atendimento).",
        },
        _default: {
          title: "Guia rápido",
          summary: "Acompanhe etapas, evidências e contrarreferência.",
          what: "Casos organizam o acompanhamento do usuário/família em etapas com SLA.",
          steps: ["Crie o caso.", "Use filtros.", "Opere na lista + detalhe."],
          after: "Melhora a qualidade e a continuidade do atendimento.",
        },
      },
    };

    const byTitle = H[tKey];
    if (!byTitle) return null;

    const subKey = norm(activeSubtabLabel);
    return byTitle[subKey] || byTitle._default || null;
  }, [title, activeSubtabLabel]);

  const helpEff = help || derivedHelp;
  const hasHelp = Boolean(
    helpEff &&
      (helpEff.summary ||
        helpEff.what ||
        helpEff.after ||
        (Array.isArray(helpEff.steps) && helpEff.steps.length))
  );

  // Fecha automaticamente ao trocar de seção/subtela
  useEffect(() => {
    setHelpOpen(false);
  }, [title, effectiveActiveKey]);

  return (
    <div className="cras-pageheader-v2">
      <div className="cras-pageheader-v2-main">
        <div className="cras-pageheader-v2-left">
          <div className="cras-pageheader-v2-eyebrow">{eyebrow}</div>
          <div className="cras-pageheader-v2-title">{title}</div>
          {subtitle ? <div className="cras-pageheader-v2-subtitle">{subtitle}</div> : null}
        </div>

        {actions?.length ? (
          <div className="cras-pageheader-v2-actions">
            {actions.map((a) => (
              <button
                key={a.key || a.label}
                type="button"
                className={"cras-action-btn " + (a.variant || "ghost")}
                onClick={() => onAction(a)}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {hasSubtabs ? (
        <div className="cras-pageheader-v2-subtabs">
          {subtabs.map((t) => {
            const k = t.key || t.label;
            return (
              <button
                key={k}
                type="button"
                className={
                  "cras-subtab-btn" + (k === effectiveActiveKey ? " is-active" : "")
                }
                onClick={() => onSubtab(k)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : hasBullets ? (
        <div className="cras-pageheader-v2-chips">
          {bullets.map((b) => (
            <span key={b} className="cras-chip">
              {b}
            </span>
          ))}
        </div>
      ) : null}

      {hasHelp ? (
        <div className="cras-help-card" aria-label="Guia rápido">
          <div className="cras-help-head">
            <div className="cras-help-head-left">
              <div className="cras-help-title">{helpEff.title || "Guia rápido"}</div>
              {helpEff.summary ? <div className="cras-help-summary">{helpEff.summary}</div> : null}
            </div>
            <button
              type="button"
              className="cras-help-toggle"
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen ? "true" : "false"}
            >
              {helpOpen ? "Fechar" : "Ver como usar"}
            </button>
          </div>

          {helpOpen ? (
            <div className="cras-help-body">
              {helpEff.what ? (
                <div className="cras-help-section">
                  <div className="cras-help-section-title">O que é</div>
                  <div className="cras-help-text">{helpEff.what}</div>
                </div>
              ) : null}

              {Array.isArray(helpEff.steps) && helpEff.steps.length ? (
                <div className="cras-help-section">
                  <div className="cras-help-section-title">Como usar</div>
                  <ul className="cras-help-list">
                    {helpEff.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {helpEff.after ? (
                <div className="cras-help-section">
                  <div className="cras-help-section-title">Depois disso</div>
                  <div className="cras-help-text">{helpEff.after}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
