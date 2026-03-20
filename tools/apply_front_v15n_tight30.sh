#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONT="$ROOT_DIR/frontend"
MAIN_JSX="$FRONT/src/main.jsx"
MAIN_TSX="$FRONT/src/main.tsx"
DASH="$FRONT/src/pages/ProducerDashboard.jsx"
CSS_IMPORT='import "./styles/fazenda_dash_tight30.css";'

if [ -f "$MAIN_JSX" ]; then
  MAIN="$MAIN_JSX"
elif [ -f "$MAIN_TSX" ]; then
  MAIN="$MAIN_TSX"
else
  echo "ERRO: nao achei src/main.jsx nem src/main.tsx" >&2
  exit 1
fi

# inject css import if missing
if ! grep -Fq "fazenda_dash_tight30.css" "$MAIN"; then
  # insert after last import
  tmp="$(mktemp)"
  awk -v ins="$CSS_IMPORT" '
    BEGIN{last=0}
    {lines[NR]=$0; if($0 ~ /^import /) last=NR}
    END{
      for(i=1;i<=NR;i++){
        print lines[i]
        if(i==last) print ins
      }
    }' "$MAIN" > "$tmp"
  mv "$tmp" "$MAIN"
fi

# add scope class to ProducerDashboard root
if [ -f "$DASH" ]; then
  if ! grep -Fq "faz-dash-tight30" "$DASH"; then
    # try to add className on root <div className="faz-page">
    perl -pi -e 's/<div className="faz-page">/<div className="faz-page faz-dash-tight30">/g' "$DASH"
  fi
else
  echo "ERRO: nao achei $DASH" >&2
  exit 1
fi

echo "OK: V15N aplicado (css import + dashboard scope)."
