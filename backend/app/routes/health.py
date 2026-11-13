from fastapi import APIRouter, Response
from sqlalchemy import text

from app.database import engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health(response: Response):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return {"status": "degraded", "database": "unavailable"}
    return {"status": "ok", "database": "ok"}
