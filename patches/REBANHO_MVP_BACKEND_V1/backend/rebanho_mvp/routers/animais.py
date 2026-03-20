from __future__ import annotations

from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from .deps import get_session
from ..models import Animal, Manga, Pesagem, Movimentacao, StatusAnimal
from ..schemas import AnimalCreate, AnimalUpdate, AnimalRead, AnimalResumo, TimelineItem
from ..services.metrics import calc_gmd

router = APIRouter(prefix="/animais", tags=["Rebanho MVP - Animais"])


def _animal_exists_brinco(session: Session, brinco: str, exclude_id: int | None = None) -> bool:
    q = select(Animal).where(Animal.brinco == brinco)
    if exclude_id is not None:
        q = q.where(Animal.id != exclude_id)
    return session.exec(q).first() is not None


@router.post("", response_model=AnimalRead)
def criar_animal(payload: AnimalCreate, session: Session = Depends(get_session)):
    if _animal_exists_brinco(session, payload.brinco):
        raise HTTPException(status_code=409, detail="Já existe animal com este brinco.")

    if payload.manga_atual_id is not None:
        m = session.get(Manga, payload.manga_atual_id)
        if not m:
            raise HTTPException(status_code=400, detail="manga_atual_id inválido.")

    a = Animal(**payload.model_dump())
    session.add(a)
    session.commit()
    session.refresh(a)
    return a


@router.get("", response_model=list[AnimalRead])
def listar_animais(
    session: Session = Depends(get_session),
    manga_id: int | None = None,
    status: StatusAnimal | None = None,
    q: str | None = Query(default=None, description="Busca simples (brinco/marca_fogo)"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    query = select(Animal)
    if manga_id is not None:
        query = query.where(Animal.manga_atual_id == manga_id)
    if status is not None:
        query = query.where(Animal.status == status)
    if q:
        qq = f"%{q.strip()}%"
        query = query.where((Animal.brinco.like(qq)) | (Animal.marca_fogo.like(qq)))

    query = query.order_by(Animal.brinco).offset(offset).limit(limit)
    return list(session.exec(query).all())


@router.get("/{animal_id}", response_model=AnimalResumo)
def obter_animal_resumo(
    animal_id: int,
    session: Session = Depends(get_session),
    gmd_dias: int = Query(default=60, ge=7, le=365, description="Período para GMD em dias"),
):
    a = session.get(Animal, animal_id)
    if not a:
        raise HTTPException(status_code=404, detail="Animal não encontrado.")

    # última pesagem
    last = session.exec(
        select(Pesagem).where(Pesagem.animal_id == animal_id).order_by(Pesagem.data.desc())
    ).first()

    # GMD no período
    fim = date.today()
    inicio = fim - timedelta(days=gmd_dias)
    pesagens_periodo = list(
        session.exec(select(Pesagem).where(Pesagem.animal_id == animal_id, Pesagem.data >= inicio, Pesagem.data <= fim)).all()
    )
    gmd, di, df = calc_gmd(pesagens_periodo)

    return AnimalResumo(
        animal=AnimalRead.model_validate(a),
        ultima_pesagem_data=(last.data if last else None),
        ultimo_peso_kg=(last.peso_kg if last else None),
        gmd_periodo=gmd,
        gmd_inicio=di,
        gmd_fim=df,
    )


@router.put("/{animal_id}", response_model=AnimalRead)
def atualizar_animal(animal_id: int, payload: AnimalUpdate, session: Session = Depends(get_session)):
    a = session.get(Animal, animal_id)
    if not a:
        raise HTTPException(status_code=404, detail="Animal não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    if "brinco" in data and data["brinco"] != a.brinco:
        if _animal_exists_brinco(session, data["brinco"], exclude_id=animal_id):
            raise HTTPException(status_code=409, detail="Já existe animal com este brinco.")

    if "manga_atual_id" in data and data["manga_atual_id"] is not None:
        m = session.get(Manga, data["manga_atual_id"])
        if not m:
            raise HTTPException(status_code=400, detail="manga_atual_id inválido.")

    for k, v in data.items():
        setattr(a, k, v)

    a.atualizado_em = __import__("datetime").datetime.utcnow()

    session.add(a)
    session.commit()
    session.refresh(a)
    return a


@router.delete("/{animal_id}")
def inativar_animal(animal_id: int, session: Session = Depends(get_session)):
    a = session.get(Animal, animal_id)
    if not a:
        raise HTTPException(status_code=404, detail="Animal não encontrado.")
    a.status = StatusAnimal.inativo
    a.atualizado_em = __import__("datetime").datetime.utcnow()
    session.add(a)
    session.commit()
    return {"ok": True, "status": a.status}


@router.get("/{animal_id}/timeline", response_model=list[TimelineItem])
def timeline_animal(animal_id: int, session: Session = Depends(get_session)):
    a = session.get(Animal, animal_id)
    if not a:
        raise HTTPException(status_code=404, detail="Animal não encontrado.")

    pesagens = list(session.exec(select(Pesagem).where(Pesagem.animal_id == animal_id)).all())
    movs = list(session.exec(select(Movimentacao).where(Movimentacao.animal_id == animal_id)).all())

    itens: list[TimelineItem] = []
    for p in pesagens:
        itens.append(TimelineItem(tipo="pesagem", data=p.data, payload={
            "id": p.id, "peso_kg": p.peso_kg, "observacao": p.observacao
        }))
    for m in movs:
        itens.append(TimelineItem(tipo="movimentacao", data=m.data, payload={
            "id": m.id, "tipo": m.tipo, "origem_manga_id": m.origem_manga_id, "destino_manga_id": m.destino_manga_id,
            "motivo": m.motivo, "responsavel": m.responsavel, "observacao": m.observacao
        }))

    itens.sort(key=lambda x: (x.data, 0 if x.tipo == "movimentacao" else 1))
    return itens
