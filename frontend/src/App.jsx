import React, { useEffect, useState } from "react";
import FazendaApp from "./FazendaApp.jsx";
import SiteHome from "./pages/SiteHome.jsx";
import LoginBridge from "./pages/LoginBridge.jsx";

const LS_AUTH = "fazenda_login_ok_v1";
const LS_USER = "fazenda_login_user_v1";
const LS_ROLE = "fazenda_login_role_v1";

function readAuth() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(LS_AUTH) === "1";
  } catch {
    return false;
  }
}

function writeAuth(ok) {
  if (typeof window === "undefined") return;
  try {
    if (ok) window.sessionStorage.setItem(LS_AUTH, "1");
    else window.sessionStorage.removeItem(LS_AUTH);
  } catch {
    // no-op
  }
}

function getInitialView(isAuthed = false) {
  if (typeof window === "undefined") return "site";
  const hash = String(window.location.hash || "").toLowerCase();
  if (hash === "#sistema") return isAuthed ? "sistema" : "login";
  if (hash === "#login") return "login";
  return "site";
}

export function App() {
  const [authenticated, setAuthenticated] = useState(readAuth);
  const [view, setView] = useState(() => getInitialView(readAuth()));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onHashChange = () => {
      const isAuthed = readAuth();
      setAuthenticated(isAuthed);
      setView(getInitialView(isAuthed));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openLogin = () => {
    if (typeof window !== "undefined") window.location.hash = "login";
    setView("login");
  };

  const openSite = () => {
    if (typeof window !== "undefined") window.location.hash = "";
    setView("site");
  };

  const finishLogin = (session = {}) => {
    writeAuth(true);
    if (typeof window !== "undefined") {
      try {
        const role = String(session?.role || "admin").trim().toLowerCase();
        const allowed = new Set(["gestor", "admin", "financeiro", "rh"]);
        window.sessionStorage.setItem(LS_USER, String(session?.user || "usuario"));
        window.sessionStorage.setItem(LS_ROLE, allowed.has(role) ? role : "admin");
      } catch {
        // no-op
      }
    }
    setAuthenticated(true);
    if (typeof window !== "undefined") window.location.hash = "sistema";
    setView("sistema");
  };

  const logout = () => {
    writeAuth(false);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(LS_USER);
        window.sessionStorage.removeItem(LS_ROLE);
      } catch {
        // no-op
      }
    }
    setAuthenticated(false);
    openLogin();
  };

  if (view === "sistema") {
    if (!authenticated) return <LoginBridge onBack={openSite} onSuccess={finishLogin} />;
    return (
      <>
        <div style={{ position: "sticky", top: 8, left: 8, zIndex: 40, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="site-back-button" type="button" onClick={openSite}>
            Voltar para o site
          </button>
          <button className="site-back-button" type="button" onClick={logout}>
            Sair
          </button>
        </div>
        <FazendaApp />
      </>
    );
  }

  if (view === "login") return <LoginBridge onBack={openSite} onSuccess={finishLogin} />;

  return <SiteHome onOpenSystem={openLogin} />;
}

export default App;
