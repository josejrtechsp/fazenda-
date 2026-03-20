from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .deps import get_session
from ..models import Manga, Animal, StatusAnimal
from ..schemas import MangaCreate, MangaUpdate, MangaRead

router = APIRouter(prefix="/mangas", tags=["Rebanho MVP - Mangas"])


@router.post("", response_model=MangaRead)
def criar_manga(payload: MangaCreate, session: Session = Depends(get_session)):
    # evita duplicidade de código
    existing = session.exec(select(Manga).where(Manga.codigo == payload.codigo)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Já existe manga com este código.")
    m = Manga(**payload.model_dump())
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.get("", response_model=list[MangaRead])
def listar_mangas(session: Session = Depends(get_session)):
    return list(session.exec(select(Manga).order_by(Manga.codigo)).all())


@router.get("/{manga_id}", response_model=MangaRead)
def obter_manga(manga_id: int, session: Session = Depends(get_session)):
    m = session.get(Manga, manga_id)
    if not m:
        raise HTTPException(status_code=404, detail="Manga não encontrada.")
    return m


@router.put("/{manga_id}", response_model=MangaRead)
def atualizar_manga(manga_id: int, payload: MangaUpdate, session: Session = Depends(get_session)):
    m = session.get(Manga, manga_id)
    if not m:
        raise HTTPException(status_code=404, detail="Manga não encontrada.")

    data = payload.model_dump(exclude_unset=True)
    if "codigo" in data and data["codigo"] != m.codigo:
        existing = session.exec(select(Manga).where(Manga.codigo == data["codigo"])).first()
        if existing:
            raise HTTPException(status_code=409, detail="Já existe manga com este código.")

    for k, v in data.items():
        setattr(m, k, v)

    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.delete("/{manga_id}")
def excluir_manga(manga_id: int, session: Session = Depends(get_session)):
    m = session.get(Manga, manga_id)
    if not m:
        raise HTTPException(status_code=404, detail="Manga não encontrada.")

    # impede excluir se há animais ativos vinculados
    ativos = session.exec(
        select(Animal).where(Animal.manga_atual_id == manga_id, Animal.status == StatusAnimal.ativo)
    ).first()
    if ativos:
        raise HTTPException(status_code=409, detail="Não pode excluir: existem animais ativos na manga.")

    session.delete(m)
    session.commit()
    return {"ok": True}


@router.get("/{manga_id}/lotacao")
def lotacao_manga(manga_id: int, session: Session = Depends(get_session)):
    m = session.get(Manga, manga_id)
    if not m:
        raise HTTPException(status_code=404, detail="Manga não encontrada.")

    animais = list(session.exec(select(Animal).where(Animal.manga_atual_id == manga_id, Animal.status == StatusAnimal.ativo)).all())
    total = len(animais)
    por_categoria: dict[str, int] = {}
    por_sexo: dict[str, int] = {}
    for a in animais:
        por_categoria[str(a.categoria)] = por_categoria.get(str(a.categoria), 0) + 1
        por_sexo[str(a.sexo)] = por_sexo.get(str(a.sexo), 0) + 1

    return {
        "manga_id": manga_id,
        "codigo": m.codigo,
        "nome": m.nome,
        "total_ativos": total,
        "por_categoria": por_categoria,
        "por_sexo": por_sexo,
    }
