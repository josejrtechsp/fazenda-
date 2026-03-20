from __future__ import annotations

import csv
from datetime import datetime
from typing import IO, Iterable, Optional

def _parse_date(s: str):
    # Aceita: YYYY-MM-DD ou DD/MM/YYYY
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def _parse_float(s: str):
    s = (s or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None

def parse_pesagens_csv(file_obj: IO[bytes]) -> list[dict]:
    """Lê um CSV de pesagens.

    Colunas aceitas (qualquer uma):
    - animal_id (int) OU brinco (string)
    - data (YYYY-MM-DD ou DD/MM/YYYY)
    - peso_kg (float)
    - observacao (opcional)
    """
    raw = file_obj.read()
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        text = raw.decode("latin-1")

    # tenta detectar separador
    sample = text[:4096]
    dialect = csv.Sniffer().sniff(sample, delimiters=";,\t,")
    reader = csv.DictReader(text.splitlines(), dialect=dialect)
    rows: list[dict] = []
    for i, r in enumerate(reader, start=2):  # linha 1 é header
        animal_id = (r.get("animal_id") or "").strip()
        brinco = (r.get("brinco") or "").strip()
        data = _parse_date(r.get("data") or "")
        peso = _parse_float(r.get("peso_kg") or "")
        obs = (r.get("observacao") or "").strip() or None

        if not data or peso is None:
            raise ValueError(f"Linha {i}: data/peso inválidos (data='{r.get('data')}', peso_kg='{r.get('peso_kg')}')")

        item = {"data": data, "peso_kg": peso, "observacao": obs}
        if animal_id:
            try:
                item["animal_id"] = int(animal_id)
            except ValueError:
                raise ValueError(f"Linha {i}: animal_id inválido: '{animal_id}'")
        elif brinco:
            item["brinco"] = brinco
        else:
            raise ValueError(f"Linha {i}: precisa de animal_id ou brinco.")
        rows.append(item)
    return rows
