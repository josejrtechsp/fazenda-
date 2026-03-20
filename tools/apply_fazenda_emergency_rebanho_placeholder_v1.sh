#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_emergency_$TS"

cat > "$FILE" <<'EOF'
import React from "react";

/**
 * PLACEHOLDER TEMPORÁRIO — Rebanho
 * Motivo: Herd.jsx estava com erro de sintaxe (JSX) e impedia o Vite de subir.
 * Próximo passo: corrigir e reintroduzir o redesign do Rebanho em patches menores e seguros.
 */
export default function Herd() {
  return (
    <div className="page">
      <div className="card">
        <div className="card-header-row" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="chip-title">OPERAÇÃO</div>
            <h2 style={{ margin: "6px 0 2px", fontWeight: 900 }}>Rebanho</h2>
            <div className="texto-suave">
              Tela temporária para o sistema voltar a abrir. Vamos corrigir o Rebanho em seguida
              (Visão geral / Lotes / Animais) com UX premium, sem quebrar build.
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill warn">Em manutenção</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>Próximo passo</div>
          <div className="texto-suave" style={{ marginTop: 6 }}>
            1) Vamos localizar o trecho quebrado no arquivo antigo (Herd.jsx) e corrigir o JSX.
            <br />
            2) Depois aplicamos o redesign do Rebanho em patches pequenos (1 tela por patch).
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>Checklist rápido (para você colar aqui)</div>
          <div className="texto-suave" style={{ marginTop: 6 }}>
            Rode no terminal:
            <br />
            <code>nl -ba frontend/src/pages/Herd.jsx.bak_* | tail -n 20</code>
            <br />
            e me mande o trecho do backup que falhou (linhas ~1280–1345).
          </div>
        </div>
      </div>
    </div>
  );
}

EOF

echo "OK ✅ Placeholder aplicado em $FILE"
echo "Backup: $FILE.bak_emergency_$TS"
