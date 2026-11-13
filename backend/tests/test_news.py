import httpx
import pytest

from app.core.errors import ConfigurationError
from app.services import news_service
from app.utils.urls import canonicalize_url
from tests.conftest import make_raw_article, register


def test_categories_are_listed(client):
    ids = [c["id"] for c in client.get("/news/categories").json()]
    assert ids == ["sports", "politics", "education", "technology", "business", "entertainment", "health", "world"]


def test_news_requires_login(client):
    assert client.get("/news?category=sports").status_code == 401


def test_news_returns_stored_summaries(client, auth, fake_gnews, fake_ai):
    res = client.get("/news?category=sports", headers=auth)
    assert res.status_code == 200
    body = res.json()
    assert len(body["articles"]) == 2 and body["summaries_failed"] == 0
    first = body["articles"][0]
    assert first["summary"].startswith("Summary of") and first["key_points"] == ["Point A", "Point B"]
    assert first["source"] == "Example Times" and first["category"] == "sports"
    assert first["content_available"] is True  # long excerpt, truncation marker removed


def test_summaries_are_not_regenerated(client, auth, fake_gnews, fake_ai):
    client.get("/news?category=sports", headers=auth)
    client.get("/news?category=sports&refresh=true", headers=auth)
    assert len(fake_ai["summaries"]) == 2  # 2 articles, summarised once each despite 2 requests
    assert fake_gnews["calls"] == 2


def test_duplicates_are_removed(client, auth, fake_gnews, fake_ai):
    a = make_raw_article(1)
    b = make_raw_article(1, url="https://NEWS.example.com/story-1/?utm_campaign=x#top")
    fake_gnews["articles"] = [a, b, make_raw_article(2)]
    assert len(client.get("/news?category=world", headers=auth).json()["articles"]) == 2


def test_invalid_articles_are_skipped(client, auth, fake_gnews, fake_ai):
    fake_gnews["articles"] = [
        make_raw_article(1, url="javascript:alert(1)"),
        make_raw_article(2, title=""),
        make_raw_article(3, image="not-a-url"),
    ]
    articles = client.get("/news?category=health", headers=auth).json()["articles"]
    assert len(articles) == 1 and articles[0]["image_url"] is None


def test_empty_results(client, auth, fake_gnews, fake_ai):
    fake_gnews["articles"] = []
    body = client.get("/news?category=business", headers=auth).json()
    assert body["articles"] == [] and body["has_more"] is False


def test_unknown_category_and_missing_params(client, auth, fake_gnews, fake_ai):
    assert client.get("/news?category=cooking", headers=auth).status_code == 422
    assert client.get("/news", headers=auth).status_code == 422


def test_search_query(client, auth, fake_gnews, fake_ai):
    res = client.get("/news?q=elections", headers=auth)
    assert res.status_code == 200 and res.json()["query"] == "elections"


def test_ai_failure_keeps_articles_and_allows_retry(client, auth, fake_gnews, monkeypatch):
    from app.core.errors import UpstreamError
    from app.services import ai_service

    def boom(article):
        raise UpstreamError("down")

    monkeypatch.setattr(ai_service, "summarize_article", boom)
    body = client.get("/news?category=sports", headers=auth).json()
    assert body["summaries_failed"] == 2 and body["articles"][0]["summary"] is None

    monkeypatch.setattr(ai_service, "summarize_article", lambda a: {"summary": "ok now", "key_points": ["p"]})
    retried = client.post(f"/news/{body['articles'][0]['id']}/summarize", headers=auth)
    assert retried.status_code == 200 and retried.json()["summary"] == "ok now"


def test_missing_gemini_key_is_a_clear_error(client, auth, fake_gnews, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "GEMINI_API_KEY", "")
    res = client.get("/news?category=sports", headers=auth)
    assert res.status_code == 503 and "GEMINI_API_KEY" in res.json()["detail"]


def test_article_detail_and_404(client, auth, fake_gnews, fake_ai):
    article_id = client.get("/news?category=sports", headers=auth).json()["articles"][0]["id"]
    assert client.get(f"/news/{article_id}", headers=auth).json()["id"] == article_id
    assert client.get("/news/9999", headers=auth).status_code == 404
    assert client.post("/news/9999/summarize", headers=auth).status_code == 404


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code, self._payload = status, payload or {}

    def json(self):
        return self._payload


@pytest.mark.parametrize("status,expected", [(401, 503), (403, 429), (429, 429), (500, 502)])
def test_gnews_error_mapping(client, auth, fake_ai, monkeypatch, status, expected):
    monkeypatch.setattr(news_service.httpx, "get", lambda *a, **k: _Resp(status))
    res = client.get("/news?category=sports", headers=auth)
    assert res.status_code == expected
    assert "test-gnews-key" not in res.text


def test_gnews_network_failure(client, auth, fake_ai, monkeypatch):
    def fail(*a, **k):
        raise httpx.ConnectError("boom https://gnews.io/?apikey=test-gnews-key")

    monkeypatch.setattr(news_service.httpx, "get", fail)
    res = client.get("/news?category=sports", headers=auth)
    assert res.status_code == 502 and "test-gnews-key" not in res.text


def test_gnews_failure_falls_back_to_database_articles(client, auth, fake_gnews, fake_ai, monkeypatch):
    # First, successfully fetch and store articles in the DB
    res1 = client.get("/news?category=sports", headers=auth)
    assert res1.status_code == 200 and len(res1.json()["articles"]) == 2

    # Now simulate GNews failing completely
    def fail(*a, **k):
        raise httpx.ConnectError("GNews provider down")

    monkeypatch.setattr(news_service.httpx, "get", fail)
    news_service.clear_cache()

    # The request should fall back to database articles instead of returning 502
    res2 = client.get("/news?category=sports", headers=auth)
    assert res2.status_code == 200
    assert len(res2.json()["articles"]) == 2
    assert res2.json()["articles"][0]["title"] == "Headline number 1"


def test_gnews_success_uses_category_and_search_endpoints(monkeypatch):
    seen = []

    def get(url, params=None, timeout=None):
        seen.append((url, params))
        return _Resp(200, {"totalArticles": 1, "articles": [make_raw_article(1)]})

    monkeypatch.setattr(news_service.httpx, "get", get)
    news_service.fetch_gnews_articles("sports", None, 1)
    news_service.fetch_gnews_articles("politics", None, 1)
    assert seen[0][0].endswith("/top-headlines") and seen[0][1]["category"] == "sports"
    assert seen[1][0].endswith("/search") and "politics" in seen[1][1]["q"] and "category" not in seen[1][1]


def test_canonical_url():
    assert canonicalize_url("HTTPS://News.Example.com:443/a/b/?utm_source=x&id=2&fbclid=1#frag") == "https://news.example.com/a/b?id=2"
    assert canonicalize_url("ftp://example.com/a") is None
    assert canonicalize_url("javascript:alert(1)") is None
