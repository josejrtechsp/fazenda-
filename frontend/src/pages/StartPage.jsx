import React, { useEffect, useMemo, useState } from "react";
import { fetchPendingSnapshot, getOperationalPendingCount, readPendingCountLocal } from "../lib/herdSignals.js";
import "../styles/start_page.css";

/**
 * StartPage — "site" interno do IDEAL_FAZENDA
 * Objetivo:
 * - Começar em 10s: Operar (Vaqueiro) ou Painel (Produtor)
 * - Atalhos: Pendências / Demo / Log do dia
 * - Sem fricção e com fallback local se o backend falhar
 */

const LS = {
  navHerd: "fazenda_nav_herd_open_v1",
  onbState: "fazenda_onboarding_v1_state",
  onbDone: "fazenda_onboarding_v1_done",
};

function readOnbProgress() {
  try {
    const done = localStorage.getItem(LS.onbDone) === "1";
    if (done) return { done: true, doneCount: 5, total: 5 };
    const raw = localStorage.getItem(LS.onbState) || "";
    const st = raw ? JSON.parse(raw) : null;
    const map = (st && st.done) || {};
    const keys = ["rebanho", "demo", "brinco", "pesagem", "log"];
    const doneCount = keys.reduce((acc, k) => acc + (map[k] ? 1 : 0), 0);
    return { done: false, doneCount, total: keys.length };
  } catch {
    return { done: false, doneCount: 0, total: 5 };
  }
}

function sendHerdNavHint(hint) {
  try {
    localStorage.setItem(LS.navHerd, JSON.stringify(hint || {}));
    window.dispatchEvent(new Event("fazenda_nav_herd_open_v1"));
  } catch {}
}

export default function StartPage({ mode = "", onGoVaqueiro = () => {}, onGoProdutor = () => {}, onNavigate = () => {} }) {
  const [pendingCount, setPendingCount] = useState(() => readPendingCountLocal());
  const [onbProgress, setOnbProgress] = useState(() => readOnbProgress());

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const snapshot = await fetchPendingSnapshot({ limit: 1, staleDays: 60 });
        if (alive) setPendingCount(getOperationalPendingCount(snapshot));
      } catch {
        if (alive) setPendingCount(readPendingCountLocal());
      }
    };
    const onRefresh = () => { void refresh(); };
    onRefresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("fazenda_pending_updated", onRefresh);
    window.addEventListener("storage", onRefresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("fazenda_pending_updated", onRefresh);
      window.removeEventListener("storage", onRefresh);
    };
  }, []);

  const subtitle = useMemo(() => {
    return mode === "vaqueiro"
      ? "Você está no modo Vaqueiro. Operação rápida por brinco."
      : mode === "produtor"
      ? "Você está no modo Produtor. KPIs e alertas para decisão."
      : "Escolha como você quer usar agora.";
  }, [mode]);

  return (
    <div className="faz-start">
      <div className="faz-panel faz-start-hero">
        <div className="faz-start-row">
          <div>
            <div className="faz-start-tag">INÍCIO</div>
            <h2 className="faz-start-title">IDEAL Fazenda</h2>
            <div className="faz-muted" style={{ marginTop: 6 }}>
              {subtitle}
            </div>
          </div>

          <div className="faz-start-kpi">
            <div className="faz-start-kpiLabel">Pendências</div>
            <div className={"faz-start-kpiValue" + (pendingCount > 0 ? " is-warn" : "")}>
              {pendingCount}
            </div>
            <div className="faz-muted" style={{ marginTop: 2 }}>
              {pendingCount > 0 ? "Ação recomendada hoje" : "Tudo em dia"}
            </div>
          </div>
        </div>

        <div className="faz-start-actions">
          <button type="button" className="faz-start-btn primary" onClick={onGoVaqueiro}>
            Operar (Vaqueiro)
            <span className="faz-start-btnSub">Pesagem • Movimento • Baixa</span>
          </button>

          <button type="button" className="faz-start-btn" onClick={onGoProdutor}>
            Painel do Produtor
            <span className="faz-start-btnSub">Pendências • KPIs • Alertas</span>
          </button>
        </div>
      </div>

      <div className="faz-start-grid">
        <div className="faz-panel faz-start-card">
          <div className="faz-start-cardTop">
            <div className="faz-start-cardTitle">Pendências</div>
            <div className={"faz-start-chip" + (pendingCount > 0 ? " is-warn" : "")}>
              {pendingCount > 0 ? `${pendingCount}` : "0"}
            </div>
          </div>
          <div className="faz-muted">Pesos suspeitos e animais sem pesagem.</div>

          <div className="faz-start-cardActions">
            <button
              type="button"
              className="faz-miniBtn"
              onClick={() => {
                sendHerdNavHint({ action: "pending" });
                onNavigate("herd");
              }}
            >
              Abrir pendências
            </button>
            <button
              type="button"
              className="faz-miniBtn ghost"
              onClick={() => {
                sendHerdNavHint({ tab: "log", logRange: "today", logType: "ALL", logSearch: "" });
                onNavigate("herd");
              }}
            >
              Caderno de hoje
            </button>
          </div>
        </div>

        <div className="faz-panel faz-start-card">
          <div className="faz-start-cardTop">
            <div className="faz-start-cardTitle">Carregar Demo</div>
            <div className="faz-start-chip">1 toque</div>
          </div>
          <div className="faz-muted">Cria dados de exemplo para testar tudo.</div>
          <div className="faz-start-cardActions">
            <button
              type="button"
              className="faz-miniBtn"
              onClick={() => {
                sendHerdNavHint({ action: "demo" });
                onNavigate("herd");
              }}
            >
              Abrir Rebanho com Demo
            </button>
          </div>
        </div>

        <div className="faz-panel faz-start-card">
          <div className="faz-start-cardTop">
            <div className="faz-start-cardTitle">Primeiros 5 minutos</div>
            <div className="faz-start-chip">guia</div>
          </div>
          <ol className="faz-start-steps">
            <li>Abra o Rebanho</li>
            <li>Carregue Demo (opcional)</li>
            <li>Digite um brinco</li>
            <li>Registre uma pesagem</li>
            <li>Veja no Caderno de Campo / Pendências</li>
          </ol>
          <div className="faz-start-cardActions">
            <button
              type="button"
              className="faz-miniBtn ghost"
              onClick={() => {
                try {
                  window.dispatchEvent(new Event("fazenda_onboarding_open"));
                } catch {}
              }}
            >
              Abrir guia ({onbProgress.doneCount}/{onbProgress.total})
            </button>

            <button
              type="button"
              className="faz-miniBtn ghost"
              onClick={() => {
                onNavigate("herd");
              }}
            >
              Ir para Rebanho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
