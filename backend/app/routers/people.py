from __future__ import annotations

import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Person, PersonCreate, PersonUpdate

router = APIRouter(prefix="/people", tags=["people"])


ROLE_FLAGS = {
    "customer": "is_customer",
    "supplier": "is_supplier",
    "employee": "is_employee",
    "carrier": "is_carrier",
    "owner": "is_owner",
}
_ALLOWED_DOC_TYPES = {"CPF", "CNPJ", "OUTRO"}


def _norm_text(v: Any) -> str:
    s = str(v or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def _digits(v: Any) -> str:
    return "".join(ch for ch in str(v or "") if ch.isdigit())


def _validate_cpf(cpf_digits: str) -> bool:
    if len(cpf_digits) != 11:
        return False
    if cpf_digits == cpf_digits[0] * 11:
        return False

    nums = [int(ch) for ch in cpf_digits]
    d1 = 11 - (sum(nums[i] * (10 - i) for i in range(9)) % 11)
    d1 = 0 if d1 >= 10 else d1

    d2 = 11 - (sum(nums[i] * (11 - i) for i in range(10)) % 11)
    d2 = 0 if d2 >= 10 else d2

    return nums[9] == d1 and nums[10] == d2


def _validate_cnpj(cnpj_digits: str) -> bool:
    if len(cnpj_digits) != 14:
        return False
    if cnpj_digits == cnpj_digits[0] * 14:
        return False

    nums = [int(ch) for ch in cnpj_digits]
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    d1 = 11 - (sum(nums[i] * w1[i] for i in range(12)) % 11)
    d1 = 0 if d1 >= 10 else d1

    d2 = 11 - (sum(nums[i] * w2[i] for i in range(13)) % 11)
    d2 = 0 if d2 >= 10 else d2

    return nums[12] == d1 and nums[13] == d2


def _normalize_document(document_type: Any, document: Any) -> Tuple[str, str]:
    raw = str(document or "").strip()
    dtype = str(document_type or "").strip().upper()

    digits = _digits(raw)
    if not dtype:
        if len(digits) == 11:
            dtype = "CPF"
        elif len(digits) == 14:
            dtype = "CNPJ"
        else:
            dtype = "OUTRO"

    if dtype not in _ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=422, detail="document_type invalido. Use CPF, CNPJ ou OUTRO")

    if dtype == "CPF":
        if not digits:
            raise HTTPException(status_code=422, detail="CPF informado sem numero")
        if not _validate_cpf(digits):
            raise HTTPException(status_code=422, detail="CPF invalido")
        return dtype, digits

    if dtype == "CNPJ":
        if not digits:
            raise HTTPException(status_code=422, detail="CNPJ informado sem numero")
        if not _validate_cnpj(digits):
            raise HTTPException(status_code=422, detail="CNPJ invalido")
        return dtype, digits

    # OUTRO: mantem texto limpo em caixa alta para comparacao consistente.
    return "OUTRO", raw.upper()


def _find_duplicate_document(
    session: Session,
    document_type: str,
    normalized_document: str,
    ignore_person_id: Optional[int] = None,
) -> Optional[Person]:
    if not normalized_document:
        return None

    rows = list(session.exec(select(Person).where(Person.is_active == True)).all())  # noqa
    for p in rows:
        if ignore_person_id is not None and int(p.id or 0) == int(ignore_person_id):
            continue
        try:
            p_dtype, p_doc = _normalize_document(p.document_type, p.document)
        except Exception:
            # legado inconsistente: compara por texto normalizado
            p_dtype = str(p.document_type or "OUTRO").strip().upper() or "OUTRO"
            p_doc = str(p.document or "").strip().upper()

        if p_dtype == document_type and p_doc == normalized_document:
            return p
    return None


def _normalize_tags_csv(v: Any) -> str:
    raw = str(v or "").strip()
    if not raw:
        return ""
    tags = [t.strip() for t in raw.split(",") if t.strip()]
    uniq = []
    seen = set()
    for t in tags:
        key = _norm_text(t)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(t)
    return ",".join(uniq)


def _has_any_role(data: Dict[str, Any]) -> bool:
    return any(bool(data.get(flag)) for flag in ROLE_FLAGS.values())


def _roles_of(person: Person) -> List[str]:
    out = []
    for role, flag in ROLE_FLAGS.items():
        if bool(getattr(person, flag, False)):
            out.append(role)
    return out


def _validate_role_filter(role: Optional[str]) -> Optional[str]:
    if role is None:
        return None
    r = str(role or "").strip().lower()
    if not r:
        return None
    if r not in ROLE_FLAGS:
        allowed = ", ".join(sorted(ROLE_FLAGS.keys()))
        raise HTTPException(status_code=422, detail=f"role invalido. Use: {allowed}")
    return r


def _serialize_person(p: Person) -> Dict[str, Any]:
    tags = [x.strip() for x in str(p.supplier_tags_csv or "").split(",") if x.strip()]
    return {
        "id": p.id,
        "name": p.name,
        "legal_name": p.legal_name,
        "document_type": p.document_type,
        "document": p.document,
        "phone": p.phone,
        "email": p.email,
        "zip_code": p.zip_code,
        "street": p.street,
        "number": p.number,
        "district": p.district,
        "city": p.city,
        "state": p.state,
        "is_customer": p.is_customer,
        "is_supplier": p.is_supplier,
        "is_employee": p.is_employee,
        "is_carrier": p.is_carrier,
        "is_owner": p.is_owner,
        "supplier_category_id": p.supplier_category_id,
        "supplier_tags_csv": p.supplier_tags_csv,
        "supplier_tags": tags,
        "bank_name": p.bank_name,
        "bank_branch": p.bank_branch,
        "bank_account": p.bank_account,
        "pix_key": p.pix_key,
        "pix_type": p.pix_type,
        "roles": _roles_of(p),
        "notes": p.notes,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("")
def list_people(
    q: Optional[str] = None,
    role: Optional[str] = Query(default=None, description="customer|supplier|employee|carrier|owner"),
    supplier_category_id: Optional[int] = None,
    include_inactive: bool = False,
    limit: int = Query(default=300, ge=1, le=3000),
    session: Session = Depends(get_session),
) -> List[Dict[str, Any]]:
    role = _validate_role_filter(role)
    stmt = select(Person)
    if not include_inactive:
        stmt = stmt.where(Person.is_active == True)  # noqa
    if role:
        stmt = stmt.where(getattr(Person, ROLE_FLAGS[role]) == True)  # noqa
    if supplier_category_id is not None:
        stmt = stmt.where(Person.supplier_category_id == int(supplier_category_id))

    rows = list(session.exec(stmt).all())
    rows.sort(key=lambda p: (str(p.name or "").lower(), int(p.id or 0)))

    if q:
        nq = _norm_text(q)
        rows = [
            p
            for p in rows
            if nq in _norm_text(p.name)
            or nq in _norm_text(p.legal_name)
            or nq in _norm_text(p.document)
            or nq in _norm_text(p.phone)
            or nq in _norm_text(p.email)
            or nq in _norm_text(p.city)
            or nq in _norm_text(p.state)
            or nq in _norm_text(p.supplier_tags_csv)
        ]

    return [_serialize_person(p) for p in rows[:limit]]


@router.get("/{person_id}")
def get_person(person_id: int, session: Session = Depends(get_session)) -> Dict[str, Any]:
    p = session.get(Person, int(person_id))
    if not p:
        raise HTTPException(status_code=404, detail="pessoa nao encontrada")
    return _serialize_person(p)


@router.post("")
def create_person(payload: PersonCreate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name e obrigatorio")

    data = payload.model_dump()
    if not _has_any_role(data):
        raise HTTPException(status_code=422, detail="selecione ao menos um tipo: cliente/fornecedor/colaborador/transportadora/proprietario")

    doc_type, doc_norm = _normalize_document(data.get("document_type"), data.get("document"))
    dup = _find_duplicate_document(session, doc_type, doc_norm)
    if dup is not None:
        raise HTTPException(status_code=422, detail=f"documento ja cadastrado para {dup.name}")

    p = Person(
        name=name,
        legal_name=str(data.get("legal_name") or "").strip(),
        document_type=doc_type,
        document=doc_norm,
        phone=str(data.get("phone") or "").strip(),
        email=str(data.get("email") or "").strip(),
        zip_code=str(data.get("zip_code") or "").strip(),
        street=str(data.get("street") or "").strip(),
        number=str(data.get("number") or "").strip(),
        district=str(data.get("district") or "").strip(),
        city=str(data.get("city") or "").strip(),
        state=str(data.get("state") or "").strip(),
        is_customer=bool(data.get("is_customer")),
        is_supplier=bool(data.get("is_supplier")),
        is_employee=bool(data.get("is_employee")),
        is_carrier=bool(data.get("is_carrier")),
        is_owner=bool(data.get("is_owner")),
        supplier_category_id=data.get("supplier_category_id"),
        supplier_tags_csv=_normalize_tags_csv(data.get("supplier_tags_csv")),
        bank_name=str(data.get("bank_name") or "").strip(),
        bank_branch=str(data.get("bank_branch") or "").strip(),
        bank_account=str(data.get("bank_account") or "").strip(),
        pix_key=str(data.get("pix_key") or "").strip(),
        pix_type=str(data.get("pix_type") or "").strip().upper(),
        notes=str(data.get("notes") or "").strip(),
        is_active=bool(data.get("is_active", True)),
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return get_person(int(p.id), session=session)


@router.patch("/{person_id}")
def update_person(person_id: int, patch: PersonUpdate, session: Session = Depends(get_session)) -> Dict[str, Any]:
    p = session.get(Person, int(person_id))
    if not p:
        raise HTTPException(status_code=404, detail="pessoa nao encontrada")

    data = patch.model_dump(exclude_unset=True)
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="name nao pode ser vazio")
        p.name = name

    new_document_type = data.get("document_type", p.document_type)
    new_document = data.get("document", p.document)
    if "document_type" in data or "document" in data:
        doc_type, doc_norm = _normalize_document(new_document_type, new_document)
        dup = _find_duplicate_document(session, doc_type, doc_norm, ignore_person_id=int(p.id or 0))
        if dup is not None:
            raise HTTPException(status_code=422, detail=f"documento ja cadastrado para {dup.name}")
        p.document_type = doc_type
        p.document = doc_norm

    for fld in (
        "legal_name",
        "phone",
        "email",
        "zip_code",
        "street",
        "number",
        "district",
        "city",
        "state",
        "bank_name",
        "bank_branch",
        "bank_account",
        "pix_key",
        "pix_type",
        "notes",
    ):
        if fld in data:
            v = str(data.get(fld) or "").strip()
            if fld == "pix_type":
                v = v.upper()
            setattr(p, fld, v)

    if "supplier_category_id" in data:
        p.supplier_category_id = data.get("supplier_category_id")
    if "supplier_tags_csv" in data:
        p.supplier_tags_csv = _normalize_tags_csv(data.get("supplier_tags_csv"))

    for fld in ("is_customer", "is_supplier", "is_employee", "is_carrier", "is_owner", "is_active"):
        if fld in data:
            setattr(p, fld, bool(data.get(fld)))

    if not _has_any_role(
        {
            "is_customer": p.is_customer,
            "is_supplier": p.is_supplier,
            "is_employee": p.is_employee,
            "is_carrier": p.is_carrier,
            "is_owner": p.is_owner,
        }
    ):
        raise HTTPException(status_code=422, detail="a pessoa precisa ter ao menos um tipo ativo")

    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    return get_person(int(p.id), session=session)


@router.post("/seed-demo")
def seed_people_demo(session: Session = Depends(get_session)) -> Dict[str, Any]:
    demo = [
        {
            "name": "Agro Nutri Minas",
            "is_supplier": True,
            "document_type": "CNPJ",
            "document": "11222333000181",
            "city": "Januaria",
            "state": "MG",
            "supplier_tags_csv": "nutricao,sal mineral",
        },
        {
            "name": "Frigorifico Boi Forte",
            "is_customer": True,
            "document_type": "OUTRO",
            "document": "",
            "city": "Montes Claros",
            "state": "MG",
        },
        {
            "name": "Jose Antonio da Silva",
            "is_owner": True,
            "document_type": "OUTRO",
            "city": "Januaria",
            "state": "MG",
        },
        {
            "name": "Joao Vaqueiro",
            "is_employee": True,
            "document_type": "OUTRO",
            "city": "Januaria",
            "state": "MG",
        },
    ]

    created = 0
    for item in demo:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        exists = session.exec(select(Person).where(Person.name == name).limit(1)).first()
        if exists:
            continue

        doc_type, doc_norm = _normalize_document(item.get("document_type"), item.get("document"))
        dup = _find_duplicate_document(session, doc_type, doc_norm)
        if dup is not None:
            continue

        p = Person(
            name=name,
            document_type=doc_type,
            document=doc_norm,
            city=str(item.get("city") or "").strip(),
            state=str(item.get("state") or "").strip(),
            is_customer=bool(item.get("is_customer")),
            is_supplier=bool(item.get("is_supplier")),
            is_employee=bool(item.get("is_employee")),
            is_carrier=bool(item.get("is_carrier")),
            is_owner=bool(item.get("is_owner")),
            supplier_tags_csv=_normalize_tags_csv(item.get("supplier_tags_csv")),
            is_active=True,
        )
        session.add(p)
        created += 1
    session.commit()
    return {"ok": True, "created": created}
