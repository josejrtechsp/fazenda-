from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlmodel import Session, select

from .deps import get_session
from ..models import Animal, Pesagem, Sexo, Categoria, StatusAnimal
from ..schemas import PesagemCreate, PesagemUpdate, PesagemRead
from ..utils.csv_import import parse_pesagens_csv

router = APIRouter(prefix="/pesagens", tags=["Rebanho MVP - Pesagens"])


@router.post("", response_model=PesagemRead)
def criar_pesagem(payload: PesagemCreate, session: Session = Depends(get_session)):
    a = session.get(Animal, payload.animal_id)
    if not a:
        raise HTTPException(status_code=400, detail="animal_id inválido.")
    p = Pesagem(**payload.model_dump())
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.get("", response_model=list[PesagemRead])
def listar_pesagens(
    session: Session = Depends(get_session),
    animal_id: int | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    q = select(Pesagem)
    if animal_id is not None:
        q = q.where(Pesagem.animal_id == animal_id)
    q = q.order_by(Pesagem.data.desc()).offset(offset).limit(limit)
    return list(session.exec(q).all())


@router.put("/{pesagem_id}", response_model=PesagemRead)
def atualizar_pesagem(pesagem_id: int, payload: PesagemUpdate, session: Session = Depends(get_session)):
    p = session.get(Pesagem, pesagem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada.")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.delete("/{pesagem_id}")
def excluir_pesagem(pesagem_id: int, session: Session = Depends(get_session)):
    p = session.get(Pesagem, pesagem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pesagem não encontrada.")
    session.delete(p)
    session.commit()
    return {"ok": True}


@router.post("/import-csv")
def importar_pesagens_csv(
    session: Session = Depends(get_session),
    file: UploadFile = File(...),
    criar_animais_se_nao_existir: bool = Query(default=False, description="Se vier brinco e não existir animal, cria automaticamente (mínimo)."),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")

    try:
        rows = parse_pesagens_csv(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    criadas = 0
    erros: list[str] = []

    for idx, r in enumerate(rows, start=1):
        try:
            animal_id = r.get("animal_id")
            if animal_id is None:
                brinco = r.get("brinco")
                a = session.exec(select(Animal).where(Animal.brinco == brinco)).first()
                if not a:
                    if not criar_animais_se_nao_existir:
                        raise ValueError(f"brinco '{brinco}' não encontrado. (use criar_animais_se_nao_existir=true)")
                    # defaults mínimos (você pode ajustar depois pelo CRUD do animal)
                    a = Animal(brinco=brinco, sexo=Sexo.macho, categoria=Categoria.outro, status=StatusAnimal.ativo)
                    session.add(a)
                    session.commit()
                    session.refresh(a)
                animal_id = a.id

            a2 = session.get(Animal, int(animal_id))
            if not a2:
                raise ValueError(f"animal_id '{animal_id}' não encontrado.")

            p = Pesagem(animal_id=a2.id, data=r["data"], peso_kg=r["peso_kg"], observacao=r.get("observacao"))
            session.add(p)
            session.commit()
            criadas += 1
        except Exception as e:
            session.rollback()
            erros.append(f"Linha #{idx}: {e}")

    return {"ok": len(erros) == 0, "criadas": criadas, "erros": erros[:50]}
