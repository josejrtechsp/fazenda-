import React, { useEffect, useMemo, useState } from "react";
import { fetchHerdOnboardingSnapshot } from "../lib/herdSignals.js";
import "../styles/onboarding.css";

/**
 * OnboardingOverlay — guia "Primeiros 5 minutos"
 * - abre sozinho na primeira vez (controle fica no FazendaApp)
 * - salva progresso em localStorage
 * - botões levam pro lugar certo (Rebanho Operar / Demo / Caderno de Campo / Pendências)
 */

const LS_STATE = "fazenda_onboarding_v1_state";
const LS_DONE = "fazenda_onboarding_v1_done";

function safeJsonParse(s, fallback) {
  try {
    const x = JSON.parse(s);
    return x == null ? fallback : x;
  } catch {
    return fallback;
  }
}

function loadLS(key, fallback) {
  try {
    return safeJsonParse(localStorage.getItem(key) || "", fallback);
  } catch {
    return fallback;
  }
}

function readData() {
  const readHerdLs = (base, fallback) => {
    const keys = [`${base}_v3`, `${base}_v2`, `${base}_v1`];
    for (const key of keys) {
      const parsed = loadLS(key, null);
      if (parsed != null) return parsed;
    }
    return fallback;
  };
  const animals = readHerdLs("faz_rebanho_animals", []);
  const log = readHerdLs("faz_rebanho_opslog", []);
  const hasAnimals = Array.isArray(animals) && animals.length > 0;
  const hasWeigh = Array.isArray(log) && log.some((it) => it && it.type === "weigh");
  const hasAnyOp = Array.isArray(log) && log.length > 0;

  const seenHerd = (() => {
    try {
      return localStorage.getItem("fazenda_onb_seen_herd_v1") === "1";
    } catch {
      return false;
    }
  })();

  const seenLog = (() => {
    try {
      return localStorage.getItem("fazenda_onb_seen_log_v1") === "1";
    } catch {
      return false;
    }
  })();

  const didBrinco = (() => {
    try {
      return localStorage.getItem("fazenda_onb_signal_brinco_v1") === "1";
    } catch {
      return false;
    }
  })();

  return { hasAnimals, hasWeigh, hasAnyOp, seenHerd, seenLog, didBrinco };
}

function defaultState() {
  return {
    step: 0,
    done: {}, // {rebanho,demo,brinco,pesagem,log}
    dismissed: false,
    seen: false,
  };
}

function readState() {
  const raw = (() => {
    try {
      return localStorage.getItem(LS_STATE) || "";
    } catch {
      return "";
    }
  })();
  const st = safeJsonParse(raw, null);
  const base = defaultState();
  if (!st || typeof st !== "object") return base;
  return {
    ...base,
    ...st,
    done: { ...(st.done || {}) },
  };
}

function saveState(st) {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(st));
    window.dispatchEvent(new Event("fazenda_onboarding_updated"));
  } catch {}
}

function setDoneFlag() {
  try {
    localStorage.setItem(LS_DONE, "1");
    window.dispatchEvent(new Event("fazenda_onboarding_updated"));
  } catch {}
}

export default function OnboardingOverlay({
  open = false,
  onClose = () => {},
  onCompleted = () => {},
  goTo = () => {},
}) {
  const [st, setSt] = useState(() => readState());
  const [data, setData] = useState(() => readData());

  // mantém estado sincronizado (se outro patch reescreveu)
  useEffect(() => {
    setSt(readState());
  }, []);

  // refresh de dados enquanto aberto
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const sync = async () => {
      const local = readData();
      if (!alive) return;
      setData(local);
      try {
        const remote = await fetchHerdOnboardingSnapshot({ activityLimit: 20 });
        if (!alive) return;
        setData((prev) => ({
          ...prev,
          ...remote,
          seenHerd: local.seenHerd,
          seenLog: local.seenLog,
          didBrinco: local.didBrinco,
        }));
      } catch {
        // fallback local já aplicado
      }
    };
    void sync();

    const id = window.setInterval(() => { void sync(); }, 5000);
    const onPend = () => { void sync(); };

    window.addEventListener("fazenda_pending_updated", onPend);
    window.addEventListener("fazenda_onboarding_signal", onPend);
    window.addEventListener("focus", onPend);

    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("fazenda_pending_updated", onPend);
      window.removeEventListener("fazenda_onboarding_signal", onPend);
      window.removeEventListener("focus", onPend);
    };
  }, [open]);

  // auto-marcar passos por evidência
  useEffect(() => {
    setSt((prev) => {
      const done = { ...(prev.done || {}) };
      let changed = false;
      if (data.seenHerd && !done.rebanho) {
        done.rebanho = true;
        changed = true;
      }
      if ((data.didBrinco || data.hasAnyOp || data.hasWeigh) && !done.brinco) {
        done.brinco = true;
        changed = true;
      }
      if (data.seenLog && !done.log) {
        done.log = true;
        changed = true;
      }
      if (data.hasAnimals && !done.demo) {
        done.demo = true;
        changed = true;
      }
      if (data.hasWeigh && !done.pesagem) {
        done.pesagem = true;
        changed = true;
      }
      if (!changed) return prev;
      const next = { ...prev, done };
      saveState(next);
      return next;
    });
  }, [data.hasAnimals, data.hasWeigh, data.hasAnyOp, data.seenHerd, data.seenLog, data.didBrinco]);

  // marcar visto
  useEffect(() => {
    if (!open) return;
    setSt((prev) => {
      if (prev.seen) return prev;
      const next = { ...prev, seen: true };
      saveState(next);
      return next;
    });
  }, [open]);

  // ESC fecha (como "agora não")
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e && e.key === "Escape") {
        setSt((prev) => {
          const next = { ...prev, dismissed: true, seen: true };
          saveState(next);
          return next;
        });
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const computedDone = useMemo(() => {
    const d = { ...(st.done || {}) };
    if (data.seenHerd) d.rebanho = true;
    if (data.hasAnimals) d.demo = true;
    if (data.didBrinco || data.hasAnyOp || data.hasWeigh) d.brinco = true;
    if (data.hasWeigh) d.pesagem = true;
    if (data.seenLog) d.log = true;
    return d;
  }, [st.done, data.seenHerd, data.hasAnimals, data.didBrinco, data.hasAnyOp, data.hasWeigh, data.seenLog]);

  const keys = ["rebanho", "demo", "brinco", "pesagem", "log"];
  const doneCount = keys.reduce((acc, k) => acc + (computedDone[k] ? 1 : 0), 0);

  const steps = useMemo(() => {
    const openHerd = (hint) => {
      goTo({ mode: "vaqueiro", active: "herd", hint: hint || { tab: "operate" } });
    };

    return [
      {
        key: "rebanho",
        title: "Abra o Rebanho (Operar)",
        desc: "No campo, o fluxo é: Brinco → peso → registrar → próximo.",
        primary: {
          label: "Ir para Operar",
          run: () => {
            openHerd({ tab: "operate" });
          },
        },
      },
      {
        key: "demo",
        title: "Carregar Demo (opcional)",
        desc: "Crie dados de exemplo para testar tudo sem medo.",
        primary: {
          label: "Carregar Demo",
          run: () => {
            openHerd({ action: "demo" });
          },
        },
        secondary: { label: "Pular", run: () => {} },
      },
      {
        key: "brinco",
        title: "Digite um brinco",
        desc: "Digite o brinco do animal e pressione Enter.",
        primary: {
          label: "Abrir Operar",
          run: () => {
            openHerd({ tab: "operate" });
          },
        },
        secondary: { label: "Já fiz", run: () => {} },
      },
      {
        key: "pesagem",
        title: "Registrar 1 pesagem",
        desc: "Digite o peso (kg) e clique em Registrar.",
        primary: {
          label: "Abrir Operar",
          run: () => {
            openHerd({ tab: "operate" });
          },
        },
        note: "Dica: se o peso estiver fora do normal, o sistema pede confirmação.",
      },
      {
        key: "log",
        title: "Ver Caderno de Campo / Pendências",
        desc: "Abra o Caderno de Campo para ver o que foi feito e o que falta.",
        primary: {
          label: "Abrir Pendências",
          run: () => {
            openHerd({ action: "pending" });
          },
        },
        secondary: {
          label: "Abrir Caderno de hoje",
          run: () => {
            openHerd({ tab: "log", logRange: "today", logType: "ALL", logSearch: "" });
          },
        },
      },
    ];
  }, [goTo]);

  const current = steps[Math.min(Math.max(0, st.step || 0), steps.length - 1)];

  function markDone(stepKey, andNext = false) {
    setSt((prev) => {
      const done = { ...(prev.done || {}) };
      done[stepKey] = true;

      const nextStep = andNext ? Math.min((prev.step || 0) + 1, steps.length - 1) : (prev.step || 0);
      const next = { ...prev, done, step: nextStep, seen: true };
      saveState(next);
      return next;
    });
  }

  function setStep(i) {
    setSt((prev) => {
      const next = { ...prev, step: Math.min(Math.max(0, i), steps.length - 1), seen: true };
      saveState(next);
      return next;
    });
  }

  function closeSoft() {
    setSt((prev) => {
      const next = { ...prev, seen: true };
      saveState(next);
      return next;
    });
    onClose();
  }

  function closeDismiss() {
    setSt((prev) => {
      const next = { ...prev, dismissed: true, seen: true };
      saveState(next);
      return next;
    });
    onClose();
  }

  function restart() {
    const next = defaultState();
    next.seen = true;
    saveState(next);
    setSt(next);
  }

  function finish() {
    setDoneFlag();
    onCompleted();
  }

  if (!open) return null;

  return (
    <div
      className="faz-onb-scrim"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e && e.target === e.currentTarget) closeDismiss();
      }}
    >
      <div className="faz-onb-modal">
        <div className="faz-onb-head">
          <div>
            <div className="faz-onb-tag">PRIMEIROS 5 MINUTOS</div>
            <div className="faz-onb-title">Guia rápido</div>
            <div className="faz-onb-sub">
              Progresso: <b>{doneCount}</b>/{steps.length}
            </div>
          </div>

          <div className="faz-onb-headBtns">
            <button type="button" className="faz-onb-btn ghost" onClick={restart}>
              Recomeçar
            </button>
            <button type="button" className="faz-onb-btn ghost" onClick={closeDismiss} aria-label="Fechar">
              Agora não
            </button>
          </div>
        </div>

        <div className="faz-onb-body">
          <div className="faz-onb-steps">
            {steps.map((s, i) => {
              const isActive = i === (st.step || 0);
              const isDone = !!computedDone[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  className={"faz-onb-step" + (isActive ? " is-active" : "") + (isDone ? " is-done" : "")}
                  onClick={() => setStep(i)}
                >
                  <span className="faz-onb-stepNum">{i + 1}</span>
                  <span className="faz-onb-stepText">{s.title}</span>
                  <span className="faz-onb-stepMark">{isDone ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>

          <div className="faz-onb-detail">
            <div className="faz-onb-progress">
              Passo <b>{(st.step || 0) + 1}</b> de <b>{steps.length}</b>
            </div>
            <h3 className="faz-onb-h3">{current.title}</h3>
            <div className="faz-onb-desc">{current.desc}</div>
            {current.note ? <div className="faz-onb-note">{current.note}</div> : null}

            <div className="faz-onb-actions">
              <button
                type="button"
                className="faz-onb-btn"
                onClick={() => {
                  try {
                    current.primary?.run?.();
                  } catch {}
                  markDone(current.key, true);
                  closeSoft();
                }}
              >
                {current.primary?.label || "Ir agora"}
              </button>

              {current.secondary ? (
                <button
                  type="button"
                  className="faz-onb-btn ghost"
                  onClick={() => {
                    try {
                      current.secondary?.run?.();
                    } catch {}
                    markDone(current.key, true);
                    closeSoft();
                  }}
                >
                  {current.secondary.label}
                </button>
              ) : (
                <button type="button" className="faz-onb-btn ghost" onClick={() => markDone(current.key, true)}>
                  Marcar como feito
                </button>
              )}

              {current.key === "pesagem" && data.hasWeigh ? (
                <div className="faz-onb-autoOk">✅ Pesagem detectada no log</div>
              ) : null}
            </div>

            <div className="faz-onb-footer">
              <button
                type="button"
                className="faz-onb-btn ghost"
                onClick={() => setStep((st.step || 0) - 1)}
                disabled={(st.step || 0) === 0}
              >
                Voltar
              </button>

              {(st.step || 0) < steps.length - 1 ? (
                <button type="button" className="faz-onb-btn ghost" onClick={() => setStep((st.step || 0) + 1)}>
                  Próximo
                </button>
              ) : (
                <button type="button" className="faz-onb-btn" onClick={finish}>
                  Concluir
                </button>
              )}
            </div>

            <div className="faz-onb-small">
              Dica: o guia não trava nada. Você pode operar e voltar depois.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
