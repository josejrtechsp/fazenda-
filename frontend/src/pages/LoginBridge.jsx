import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function LoginBridge({ onBack = () => {}, onSuccess = () => {} }) {
  const [user, setUser] = useState("admin@fazenda.local");
  const [role, setRole] = useState(() => {
    if (typeof window === "undefined") return "admin";
    try {
      const v = String(window.sessionStorage.getItem("fazenda_login_role_v1") || "admin").toLowerCase();
      if (["gestor", "admin", "financeiro", "rh"].includes(v)) return v;
    } catch {
      // no-op
    }
    return "admin";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .get("/health")
      .then(() => {
        if (!mounted) return;
        setHealthError("");
      })
      .catch(() => {
        if (!mounted) return;
        setHealthError("O backend não respondeu. Confirme se http://127.0.0.1:8001/health abre no navegador.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  function submit(e) {
    e.preventDefault();
    const u = String(user || "").trim();
    const p = String(password || "").trim();
    if (!u || !p) {
      setError("Informe usuário e senha para entrar.");
      return;
    }
    setError("");
    onSuccess({ user: u, role });
  }

  return (
    <div className="login-root login-v2-root cras-ui-v2">
      <div className="login-shell login-v2-shell">
        <aside className="login-side login-v2-side">
          <span className="login-logo-tag login-v2-kicker">SISTEMA FAZENDA IDEAL · MÓDULO: GESTÃO</span>
          <h1 className="login-side-title login-v2-title-main">Fazenda em rede, com dados qualificados.</h1>
          <p className="login-side-text login-v2-text">
            Organize a operação, conecte equipes e tome decisões com base em dados reais do campo.
          </p>
          <ul className="login-side-lista login-v2-list">
            <li>
              <span className="login-v2-mark">🧭</span>
              <span>
                <b>Linha de rotina</b> para acompanhar rebanho e tarefas
              </span>
            </li>
            <li>
              <span className="login-v2-mark">👥</span>
              <span>
                <b>Perfis e hierarquia</b> para operação, gestão e proprietário
              </span>
            </li>
            <li>
              <span className="login-v2-mark">📊</span>
              <span>
                <b>Gestão por indicadores</b> com dados de custo, clima e reprodução
              </span>
            </li>
          </ul>
        </aside>

        <section className="login-card login-v2-card">
          <div className="login-v2-topline">
            <button type="button" className="btn btn-secundario login-v2-back" onClick={onBack}>
              ← Voltar para módulos
            </button>
            <span className="login-tag login-v2-restricted">ACESSO RESTRITO</span>
          </div>

          <div className="login-header login-v2-header">
            <h2 className="login-title">Entrar no painel</h2>
            <p className="login-subtitle">Use seu e-mail institucional e senha para acessar o sistema.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <div>
              <label className="form-label" htmlFor="login-user">
                E-mail
              </label>
              <input
                id="login-user"
                className="input login-v2-input"
                type="email"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="admin@fazenda.local"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="login-pass">
                Senha
              </label>
              <input
                id="login-pass"
                className="input login-v2-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="login-role">
                Perfil de aprovação
              </label>
              <select
                id="login-role"
                className="input login-v2-input"
                value={role}
                onChange={(e) => setRole(String(e.target.value || "admin"))}
              >
                <option value="admin">Admin</option>
                <option value="gestor">Gestor</option>
                <option value="financeiro">Financeiro</option>
                <option value="rh">RH</option>
              </select>
            </div>

            {error ? <div className="erro-global">{error}</div> : null}
            {healthError ? <div className="login-v2-health-error">{healthError}</div> : null}

            <div className="login-v2-actions">
              <button type="submit" className="btn btn-primario login-v2-submit">
                Entrar
              </button>
            </div>
          </form>

          <div className="login-v2-profiles">
            <h3>Perfis de acesso</h3>
            <p>
              <b>Operador:</b> registra atendimentos e rotinas de campo.
            </p>
            <p>
              <b>Coordenação municipal:</b> acompanha indicadores e decisões do município.
            </p>
            <p>
              <b>Gestor do consórcio:</b> visão regional.
            </p>
            <p>
              <b>Admin:</b> acesso total.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
