from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from .deps import get_session
from ..models import Animal, Manga, Movimentacao, TipoMovimentacao, StatusAnimal
from ..schemas import MovimentacaoCreate, MovimentacaoRead

router = APIRouter(prefix="/movimentacoes", tags=["Rebanho MVP - Movimentações"])


@router.post("", response_model=MovimentacaoRead)
def criar_movimentacao(payload: MovimentacaoCreate, session: Session = Depends(get_session)):
    a = session.get(Animal, payload.animal_id)
    if not a:
        raise HTTPException(status_code=400, detail="animal_id inválido.")

    # valida mangas se vierem
    if payload.origem_manga_id is not None and not session.get(Manga, payload.origem_manga_id):
        raise HTTPException(status_code=400, detail="origem_manga_id inválido.")
    if payload.destino_manga_id is not None and not session.get(Manga, payload.destino_manga_id):
        raise HTTPException(status_code=400, detail="destino_manga_id inválido.")

    m = Movimentacao(**payload.model_dump())
    session.add(m)

    # regras básicas (core do Rebanho)
    if payload.tipo == TipoMovimentacao.transferencia_manga:
        if payload.destino_manga_id is None:
            raise HTTPException(status_code=400, detail="Para transferência, destino_manga_id é obrigatório.")
        a.manga_atual_id = payload.destino_manga_id

    if payload.tipo == TipoMovimentacao.venda:
        a.status = StatusAnimal.vendido
    elif payload.tipo == TipoMovimentacao.morte:
        a.status = StatusAnimal.morto
    elif payload.tipo == TipoMovimentacao.descarte:
        a.status = StatusAnimal.descarte

    a.atualizado_em = __import__("datetime").datetime.utcnow()
    session.add(a)

    session.commit()
    session.refresh(m)
    return m


@router.get("", response_model=list[MovimentacaoRead])
def listar_movimentacoes(
    session: Session = Depends(get_session),
    animal_id: int | None = None,
    manga_id: int | None = Query(default=None, description="Filtra por origem OU destino"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    q = select(Movimentacao)
    if animal_id is not None:
        q = q.where(Movimentacao.animal_id == animal_id)
    if manga_id is not None:
        q = q.where((Movimentacao.origem_manga_id == manga_id) | (Movimentacao.destino_manga_id == manga_id))
    q = q.order_by(Movimentacao.data.desc()).offset(offset).limit(limit)
    return list(session.exec(q).all())
