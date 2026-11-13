from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryOut(BaseModel):
    id: str
    label: str


class ArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None = None
    image_url: str | None = None
    original_url: str
    source: str | None = None
    published_at: datetime | None = None
    category: str
    summary: str | None = None
    key_points: list[str] | None = None
    content_available: bool = False


class NewsListResponse(BaseModel):
    articles: list[ArticleOut]
    category: str | None = None
    query: str | None = None
    page: int
    page_size: int
    total: int
    has_more: bool
    # How many articles still have no AI summary because the AI call failed (the user can retry).
    summaries_failed: int = 0
