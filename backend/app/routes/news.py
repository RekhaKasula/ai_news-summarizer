from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import AppError
from app.core.rate_limit import rate_limit
from app.database import get_db
from app.models.article import Article
from app.models.user import User
from app.schemas.news import ArticleOut, CategoryOut, NewsListResponse
from app.services import news_service

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/categories", response_model=list[CategoryOut])
def categories():
    return [CategoryOut(id=cid, label=cfg["label"]) for cid, cfg in news_service.CATEGORIES.items()]


@router.get(
    "",
    response_model=NewsListResponse,
    dependencies=[Depends(rate_limit("news", max_requests=30, window_seconds=60))],
)
def list_news(
    category: str | None = Query(default=None, description="One of /news/categories"),
    q: str | None = Query(default=None, max_length=100, description="Free-text search"),
    page: int = Query(default=1, ge=1, le=50),
    refresh: bool = Query(default=False, description="Bypass the server cache"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = (q or "").strip() or None
    if category is not None:
        category = category.lower()
        if category not in news_service.CATEGORIES:
            raise AppError(f"Unknown category '{category}'.", 422)
    if category is None and q is None:
        raise AppError("Provide a category or a search query.", 422)
    return news_service.get_news_page(db, category, q, page, refresh)


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    article = db.get(Article, article_id)
    if article is None:
        raise AppError("Article not found.", 404)
    if article.summary is None:
        try:
            news_service.summarize_one(db, article)
        except Exception:
            pass  # keep returning the article even if the AI service is momentarily unavailable
    return article


@router.post(
    "/{article_id}/summarize",
    response_model=ArticleOut,
    dependencies=[Depends(rate_limit("summarize", max_requests=20, window_seconds=60))],
)
def summarize_article(
    article_id: int,
    force: bool = Query(default=False, description="Regenerate even if a summary exists"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    article = db.get(Article, article_id)
    if article is None:
        raise AppError("Article not found.", 404)
    return news_service.summarize_one(db, article, force)
