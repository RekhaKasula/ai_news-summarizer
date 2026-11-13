"""Test setup: in-memory SQLite, fake API keys, and mocked GNews/Gemini (no network, no cost)."""
import os

# Set BEFORE importing the app so the settings/engine pick these up (overrides any real .env values).
os.environ.update(
    DATABASE_URL="sqlite+pysqlite:///:memory:",
    JWT_SECRET_KEY="test-secret-key-test-secret-key-1234567890",
    GNEWS_API_KEY="test-gnews-key",
    GEMINI_API_KEY="test-gemini-key",
    GEMINI_MODEL="test-model",
    RATE_LIMIT_ENABLED="false",
    FRONTEND_URL="http://localhost:5173",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.rate_limit import reset_rate_limits  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import ai_service, news_service  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_state():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    news_service.clear_cache()
    reset_rate_limits()
    yield


@pytest.fixture()
def client():
    return TestClient(app)


def make_raw_article(n: int = 1, **overrides) -> dict:
    raw = {
        "title": f"Headline number {n}",
        "description": f"Short description for story {n}.",
        "content": f"Longer excerpt for story {n}. " * 12 + "... [900 chars]",
        "url": f"https://news.example.com/story-{n}?utm_source=feed",
        "image": f"https://img.example.com/{n}.jpg",
        "publishedAt": "2026-11-01T10:00:00Z",
        "source": {"name": "Example Times", "url": "https://news.example.com"},
    }
    raw.update(overrides)
    return raw


@pytest.fixture()
def fake_ai(monkeypatch):
    """Replace Gemini. `calls` records every request so tests can assert caching."""
    calls = {"summaries": [], "chats": []}

    def summarize(article):
        calls["summaries"].append(article["title"])
        return {"summary": f"Summary of {article['title']}", "key_points": ["Point A", "Point B"]}

    def chat(article, history, question):
        calls["chats"].append({"article": article, "history": history, "question": question})
        return f"Answer to: {question}"

    monkeypatch.setattr(ai_service, "summarize_article", summarize)
    monkeypatch.setattr(ai_service, "generate_chat_reply", chat)
    return calls


@pytest.fixture()
def fake_gnews(monkeypatch):
    """Replace the GNews HTTP call. Tests set state['articles']."""
    state = {"articles": [make_raw_article(1), make_raw_article(2)], "calls": 0}

    def fetch(category, q, page, refresh=False):
        state["calls"] += 1
        return state["articles"], len(state["articles"])

    monkeypatch.setattr(news_service, "fetch_gnews_articles", fetch)
    return state


def register(client, email="alice@example.com", name="Alice", password="password123"):
    res = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture()
def auth(client):
    return register(client)
