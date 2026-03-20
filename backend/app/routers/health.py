from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health_get():
    return {"ok": True}

@router.head("/health")
def health_head():
    # HEAD precisa existir para checks rápidos no front/infra
    return
