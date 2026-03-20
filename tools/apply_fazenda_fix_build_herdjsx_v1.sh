#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/pages/Herd.jsx"
[ -f "$FILE" ] || { echo "ERRO: $FILE não encontrado. Rode na raiz do projeto."; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$FILE.bak_fix_$TS"

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/pages/Herd.jsx")
s = p.read_text(encoding="utf-8", errors="ignore")

out = []
i = 0
n = len(s)

in_squote = False
in_dquote = False
in_btick = False
in_line_comment = False
in_block_comment = False

def in_string():
    return in_squote or in_dquote or in_btick

while i < n:
    ch = s[i]
    nxt = s[i+1] if i+1 < n else ""

    # comments only when outside strings
    if not in_string():
        if in_line_comment:
            out.append(ch)
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            out.append(ch)
            if ch == "*" and nxt == "/":
                out.append(nxt)
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
        if ch == "/" and nxt == "/":
            out.append(ch); out.append(nxt)
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            out.append(ch); out.append(nxt)
            in_block_comment = True
            i += 2
            continue

    # toggle strings (not in comments)
    if not in_line_comment and not in_block_comment:
        if ch == "'" and not in_dquote and not in_btick:
            # open/close if not escaped
            if not in_squote:
                in_squote = True
            else:
                # count backslashes immediately before
                j = len(out) - 1
                bs = 0
                while j >= 0 and out[j] == "\":
                    bs += 1; j -= 1
                if bs % 2 == 0:
                    in_squote = False
            out.append(ch); i += 1; continue

        if ch == '"' and not in_squote and not in_btick:
            if not in_dquote:
                in_dquote = True
            else:
                j = len(out) - 1
                bs = 0
                while j >= 0 and out[j] == "\":
                    bs += 1; j -= 1
                if bs % 2 == 0:
                    in_dquote = False
            out.append(ch); i += 1; continue

        if ch == "`" and not in_squote and not in_dquote:
            if not in_btick:
                in_btick = True
            else:
                j = len(out) - 1
                bs = 0
                while j >= 0 and out[j] == "\":
                    bs += 1; j -= 1
                if bs % 2 == 0:
                    in_btick = False
            out.append(ch); i += 1; continue

    # main fix: outside strings, replace " -> " and ' -> '
    if not in_string() and ch == "\" and nxt in ['"', "'"]:
        out.append(nxt)
        i += 2
        continue

    out.append(ch)
    i += 1

p.write_text("".join(out), encoding="utf-8")
print("OK: Herd.jsx normalizado (remove escapes fora de strings).")
PY

echo "OK ✅ Patch aplicado."
echo "Backup: $FILE.bak_fix_$TS"
