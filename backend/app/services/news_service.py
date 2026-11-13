"""Fetch news from GNews, normalise it, de-duplicate, store it and attach AI summaries.

Flow for GET /news:  GNews (cached) -> normalise -> drop duplicates -> upsert in PostgreSQL
                     -> summarise only articles that have no stored summary -> return.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, ConfigurationError, RateLimitedError, UpstreamError
from app.models.article import Article
from app.services import ai_service
from app.utils.text import clean_text, strip_truncation_marker
from app.utils.urls import MAX_URL_LENGTH, canonicalize_url, is_valid_http_url
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
logger = logging.getLogger(__name__)

GNEWS_BASE_URL = "https://gnews.io/api/v4"

# mode "category" -> /top-headlines?category=...   mode "search" -> /search?q=...
# GNews has no politics/education category, so those use search queries (not fake categories).
CATEGORIES: dict[str, dict] = {
    "sports": {"label": "Sports", "mode": "category", "value": "sports"},
    "politics": {"label": "Politics", "mode": "search", "value": "politics OR election OR parliament OR government"},
    "education": {"label": "Education", "mode": "search", "value": "education OR university OR school OR students"},
    "technology": {"label": "Technology", "mode": "category", "value": "technology"},
    "business": {"label": "Business", "mode": "category", "value": "business"},
    "entertainment": {"label": "Entertainment", "mode": "category", "value": "entertainment"},
    "health": {"label": "Health", "mode": "category", "value": "health"},
    "world": {"label": "World", "mode": "category", "value": "world"},
}

_cache: dict[tuple, tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


# ---------------------------------------------------------------- GNews access
def fetch_gnews_articles(category: str | None, q: str | None, page: int, refresh: bool = False) -> tuple[list[dict], int]:
    """Fetch articles from Google News RSS."""
    settings = get_settings()

    key = (category, q, page, settings.NEWS_PAGE_SIZE)

    if refresh:
        clear_cache()

    now = time.monotonic()

    if not refresh:
        with _cache_lock:
            hit = _cache.get(key)
            if hit and hit[0] > now:
                return hit[1]["articles"], hit[1]["total"]

    queries = {
        "sports": "sports",
        "politics": "politics OR election OR parliament",
        "education": "education OR university OR school",
        "technology": "technology OR artificial intelligence",
        "business": "business OR economy",
        "entertainment": "entertainment OR movies",
        "health": "health OR medical",
        "world": "world news",
    }

    search_query = q or queries.get(category, "latest news")

    params = {
        "q": search_query,
        "hl": "en-IN",
        "gl": "IN",
        "ceid": "IN:en",
    }

    try:
        response = httpx.get(
            "https://news.google.com/rss/search",
            params=params,
            timeout=20.0,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()

        root = ET.fromstring(response.content)

        articles = []

        for entry in root.findall("./channel/item"):
            source_element = entry.find("source")

            articles.append({
                "title": entry.findtext("title"),
                "description": entry.findtext("description"),
                "content": "",
                "url": entry.findtext("link"),
                "image": None,
                "publishedAt": entry.findtext("pubDate"),
                "source": {
                    "name": source_element.text if source_element is not None else "Google News"
                },
            })

        total = len(articles)
        start = (page - 1) * settings.NEWS_PAGE_SIZE
        articles = articles[start:start + settings.NEWS_PAGE_SIZE]

    except (httpx.HTTPError, ET.ParseError) as exc:
        logger.warning("Google News RSS request failed: %s", type(exc).__name__)
        raise UpstreamError("Could not fetch news. Please try again.")

    with _cache_lock:
        _cache[key] = (
            time.monotonic() + settings.NEWS_CACHE_TTL_SECONDS,
            {"articles": articles, "total": total},
        )

    return articles, total
# ---------------------------------------------------------------- normalisation
def _parse_date(value) -> datetime | None:
    if not value or not isinstance(value, str):
        return None

    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = parsedate_to_datetime(value)
        except (ValueError, TypeError, OverflowError):
            return None

    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

def normalize_article(raw: dict, category: str) -> dict | None:
    """Convert one GNews article to our column names. Returns None if it is unusable."""
    if not isinstance(raw, dict):
        return None
    title = clean_text(raw.get("title"))
    url = raw.get("url")
    canonical = canonicalize_url(url) if isinstance(url, str) else None
    if not title or not canonical:
        return None
    description = clean_text(raw.get("description"))
    content = strip_truncation_marker(clean_text(raw.get("content")))
    image = raw.get("image") if isinstance(raw.get("image"), str) else None
    if image and (not is_valid_http_url(image) or len(image) > MAX_URL_LENGTH):
        image = None
    source = raw.get("source") if isinstance(raw.get("source"), dict) else {}
    return {
        "title": title[:500],
        "description": description,
        "content": content,
        "image_url": image,
        "original_url": url.strip(),
        "canonical_url": canonical,
        "source": (clean_text(source.get("name")) or None) and clean_text(source.get("name"))[:255],
        "published_at": _parse_date(raw.get("publishedAt")),
        "category": category,
        "content_available": bool(content and len(content) > len(description or "") + 50),
    }


def upsert_articles(db: Session, items: list[dict], _retry: bool = True) -> list[Article]:
    """Insert new articles, reuse existing ones (matched by canonical URL). Keeps input order."""
    if not items:
        return []
    existing = {
        a.canonical_url: a
        for a in db.scalars(select(Article).where(Article.canonical_url.in_([i["canonical_url"] for i in items])))
    }
    result: list[Article] = []
    for item in items:
        article = existing.get(item["canonical_url"])
        if article is None:
            article = Article(**item)
            db.add(article)
            existing[item["canonical_url"]] = article
        else:  # fill in details we did not have before; never overwrite a stored summary
            for field in ("description", "content", "image_url"):
                if not getattr(article, field) and item[field]:
                    setattr(article, field, item[field])
            if item["content_available"] and not article.content_available:
                article.content_available = True
        result.append(article)
    try:
        db.commit()
    except IntegrityError:  # another request inserted the same URL at the same moment
        db.rollback()
        if not _retry:
            raise
        return upsert_articles(db, items, _retry=False)
    return result


# ---------------------------------------------------------------- summaries
def _ai_input(article: Article) -> dict:
    return {
        "title": article.title,
        "description": article.description,
        "content": article.content,
        "source": article.source,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "content_available": article.content_available,
    }


def _store_summary(article: Article, result: dict) -> None:
    article.summary = result["summary"]
    article.key_points = result["key_points"]


def ensure_summaries(db: Session, articles: list[Article], max_to_summarize: int | None = None) -> int:
    """Summarise articles that have no stored summary (in parallel). Returns how many failed.

    Configuration problems (bad/missing key) are raised; transient AI errors only count as failures
    so the user still sees the news and can retry a single article.
    """
    pending = [a for a in articles if a.summary is None]
    if not pending:
        return 0
    limit = max_to_summarize if max_to_summarize is not None else get_settings().AUTO_SUMMARIZE_LIMIT
    to_summarize = pending[:limit] if limit > 0 else []
    if not to_summarize:
        return 0
    workers = max(1, min(get_settings().SUMMARY_CONCURRENCY, len(to_summarize)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [(a, pool.submit(ai_service.summarize_article, _ai_input(a))) for a in to_summarize]
        outcomes = []
        for article, future in futures:
            try:
                outcomes.append((article, future.result(), None))
            except ConfigurationError:
                raise
            except AppError as exc:
                outcomes.append((article, None, exc))
    failed = 0
    for article, result, error in outcomes:
        if error is not None:
            failed += 1
        else:
            _store_summary(article, result)
    db.commit()
    return failed


def summarize_one(db: Session, article: Article, force: bool = False) -> Article:
    if article.summary is None or force:
        _store_summary(article, ai_service.summarize_article(_ai_input(article)))
        db.commit()
    return article


# ---------------------------------------------------------------- public entry point
def get_news_page(db: Session, category: str | None, q: str | None, page: int, refresh: bool = False) -> dict:
    settings = get_settings()
    if not settings.GEMINI_API_KEY:  # fail early with a clear message instead of returning half a feed
        raise ConfigurationError("The Gemini API key is not configured on the server. Set GEMINI_API_KEY in backend/.env.")

    upstream_error = None
    try:
        raw_articles, total = fetch_gnews_articles(category, q, page, refresh)
    except (UpstreamError, RateLimitedError) as exc:
        upstream_error = exc
        raw_articles, total = [], 0

    if upstream_error is not None:
        # Fallback to existing articles in PostgreSQL if GNews has issues or quota limit
        query = select(Article)
        if category:
            query = query.where(Article.category == category)
        elif q:
            query = query.where(Article.title.ilike(f"%{q}%"))
        cached_articles = list(
            db.scalars(
                query.order_by(Article.published_at.desc().nullslast(), Article.id.desc())
                .offset((page - 1) * settings.NEWS_PAGE_SIZE)
                .limit(settings.NEWS_PAGE_SIZE)
            )
        )
        if cached_articles:
            logger.info("Serving %d cached articles from database due to news provider issue", len(cached_articles))
            return {
                "articles": cached_articles,
                "category": category,
                "query": q,
                "page": page,
                "page_size": settings.NEWS_PAGE_SIZE,
                "total": len(cached_articles),
                "has_more": False,
                "summaries_failed": 0,
            }
        # If DB has no cached articles either, re-raise the upstream error
        raise upstream_error

    stored_category = category or "general"
    seen: set[str] = set()
    items: list[dict] = []
    for raw in raw_articles:
        item = normalize_article(raw, stored_category)
        if item and item["canonical_url"] not in seen:
            seen.add(item["canonical_url"])
            items.append(item)

    articles = upsert_articles(db, items)
    failed = ensure_summaries(db, articles)
    page_size = settings.NEWS_PAGE_SIZE
    return {
        "articles": articles,
        "category": category,
        "query": q,
        "page": page,
        "page_size": page_size,
        "total": total,
        "has_more": len(raw_articles) >= page_size and page * page_size < total,
        "summaries_failed": failed,
    }
