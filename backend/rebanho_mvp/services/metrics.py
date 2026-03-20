from __future__ import annotations

from datetime import date
from typing import Optional, Sequence
from ..models import Pesagem

def calc_gmd(pesagens: Sequence[Pesagem], inicio: Optional[date] = None, fim: Optional[date] = None) -> tuple[Optional[float], Optional[date], Optional[date]]:
    """Calcula GMD (kg/dia) entre a primeira e a última pesagem do período.
    Retorna (gmd, data_inicio, data_fim).
    """
    if not pesagens:
        return None, None, None

    # Ordena por data
    ps = sorted(pesagens, key=lambda p: p.data)
    if inicio:
        ps = [p for p in ps if p.data >= inicio]
    if fim:
        ps = [p for p in ps if p.data <= fim]

    if len(ps) < 2:
        return None, None, None

    p0 = ps[0]
    p1 = ps[-1]
    dias = (p1.data - p0.data).days
    if dias <= 0:
        return None, p0.data, p1.data
    gmd = (p1.peso_kg - p0.peso_kg) / float(dias)
    return gmd, p0.data, p1.data
