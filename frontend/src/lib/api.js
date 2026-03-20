export function getApiBase(){
  const env = (import.meta?.env?.VITE_API_BASE || "").trim();
  const isDev = !!import.meta?.env?.DEV;

  // Forca /api no desenvolvimento para evitar CORS.
  // Regra: se estiver rodando via Vite (normalmente porta 517x), use sempre /api.
  if (typeof window !== "undefined") {
    const p = String(window.location.port || "");
    if (p.startsWith("517")) return "/api";
  }

  // Em DEV, evite CORS usando o proxy do Vite (/api -> :8001)
  // Mesmo se o usuário tiver VITE_API_BASE=http://127.0.0.1:8001, forçamos /api.
  if (isDev) {
    if (!env) return "/api";
    if (/^https?:\/\/(localhost|127\.0\.0\.1):8001\b/i.test(env)) return "/api";
  }

  return env || "http://localhost:8001";
}

async function req(path, opts={}){
  const base = getApiBase().replace(/\/$/, "");
  const isAbs = /^https?:\/\//i.test(base);
  const url = path.startsWith("http")
    ? path
    : (isAbs
      ? `${base}${path.startsWith("/")?"":"/"}${path}`
      : `${base}${path.startsWith("/")?"":"/"}${path}`);

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    },
    ...opts,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = data.detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        const parts = detail
          .map((d) => {
            if (typeof d === "string") return d;
            if (d && typeof d === "object") {
              return d.msg || d.message || JSON.stringify(d);
            }
            return String(d);
          })
          .filter(Boolean);
        msg = parts.join(" | ") || msg;
      } else if (detail && typeof detail === "object") {
        msg = detail.message || detail.msg || JSON.stringify(detail);
      }
    } else if (typeof data === "string" && data.trim()) {
      msg = data.trim();
    }
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => req(path, { method: "GET" }),
  post: (path, body) => req(path, { method: "POST", body: JSON.stringify(body || {}) }),
  patch: (path, body) => req(path, { method: "PATCH", body: JSON.stringify(body || {}) }),
  put: (path, body) => req(path, { method: "PUT", body: JSON.stringify(body || {}) }),
};
