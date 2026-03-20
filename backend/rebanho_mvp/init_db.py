from __future__ import annotations

from .core.db import init_db

def main():
    init_db()
    print("OK ✅ Banco inicializado (Rebanho MVP).")

if __name__ == "__main__":
    main()
