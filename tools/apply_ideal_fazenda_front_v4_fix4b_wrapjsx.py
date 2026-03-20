#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "frontend" / "src" / "pages" / "ProducerDashboard.jsx"

def main():
    if not TARGET.exists():
        print(f"FALTA: {TARGET}")
        return 2

    s = TARGET.read_text(encoding="utf-8", errors="ignore")

    # Já embrulhado -> idempotente
    if re.search(r"return\s*\(\s*<>", s):
        print("OK: ProducerDashboard.jsx já está embrulhado em fragment.")
        return 0

    # Encontra 'return (\n'
    m = re.search(r"return\s*\(\s*\n", s)
    if not m:
        print("ERRO: não encontrei 'return (\n' para aplicar wrap.")
        return 3

    insert_pos = m.end()
    s = s[:insert_pos] + "    <>\n" + s[insert_pos:]

    # Insere fechamento '</>' antes do fechamento final do return: ');' no fim do arquivo
    # Procura por: \n  );\n} (com indent variável)
    m2 = re.search(r"\n(\s*)\);\s*\n\s*}\s*$", s)
    if not m2:
        print("ERRO: não encontrei o fechamento final ');' para inserir </>.")
        return 4

    indent = m2.group(1)
    tail = f"\n    </>\n{indent});\n}}\n"
    s = re.sub(r"\n(\s*)\);\s*\n\s*}\s*$", tail, s)

    TARGET.write_text(s, encoding="utf-8")
    print("OK: wrap JSX aplicado em ProducerDashboard.jsx (fragment).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
