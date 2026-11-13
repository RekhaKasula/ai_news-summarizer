from app.core.errors import UpstreamError
from app.services import ai_service
from tests.conftest import register


def _article_id(client, auth):
    return client.get("/news?category=sports", headers=auth).json()["articles"][0]["id"]


def test_chat_requires_login(client):
    assert client.get("/chat/sessions").status_code == 401
    assert client.post("/chat/sessions", json={}).status_code == 401


def test_create_session_for_article(client, auth, fake_gnews, fake_ai):
    article_id = _article_id(client, auth)
    res = client.post("/chat/sessions", json={"article_id": article_id}, headers=auth)
    assert res.status_code == 201
    body = res.json()
    assert body["article_id"] == article_id and body["title"].startswith("Chat: Headline number")
    assert client.post("/chat/sessions", json={"article_id": 999}, headers=auth).status_code == 404


def test_messages_are_stored_and_reloaded(client, auth, fake_gnews, fake_ai):
    article_id = _article_id(client, auth)
    sid = client.post("/chat/sessions", json={"article_id": article_id}, headers=auth).json()["id"]

    res = client.post(f"/chat/sessions/{sid}/messages", json={"content": "Explain simply"}, headers=auth)
    assert res.status_code == 201
    assert res.json()["assistant_message"]["content"] == "Answer to: Explain simply"
    client.post(f"/chat/sessions/{sid}/messages", json={"content": "What next?"}, headers=auth)

    detail = client.get(f"/chat/sessions/{sid}", headers=auth).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert detail["messages"][2]["content"] == "What next?"

    # The model received the article as context and the earlier turns as history.
    last = fake_ai["chats"][-1]
    assert last["article"]["title"] == "Headline number 1"
    assert last["history"] == [("user", "Explain simply"), ("assistant", "Answer to: Explain simply")]


def test_history_window_is_limited(client, auth, fake_gnews, fake_ai, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "CHAT_HISTORY_WINDOW", 2)
    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    for i in range(3):
        client.post(f"/chat/sessions/{sid}/messages", json={"content": f"q{i}"}, headers=auth)
    assert len(fake_ai["chats"][-1]["history"]) == 2


def test_general_session_title_comes_from_first_question(client, auth, fake_ai):
    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    assert client.get(f"/chat/sessions/{sid}", headers=auth).json()["title"] == "New conversation"
    client.post(f"/chat/sessions/{sid}/messages", json={"content": "What is inflation?"}, headers=auth)
    assert client.get(f"/chat/sessions/{sid}", headers=auth).json()["title"] == "What is inflation?"


def test_list_sessions_most_recent_first(client, auth, fake_ai):
    first = client.post("/chat/sessions", json={"title": "one"}, headers=auth).json()["id"]
    second = client.post("/chat/sessions", json={"title": "two"}, headers=auth).json()["id"]
    client.post(f"/chat/sessions/{first}/messages", json={"content": "hello"}, headers=auth)
    ids = [s["id"] for s in client.get("/chat/sessions", headers=auth).json()]
    assert ids == [first, second]


def test_users_cannot_access_each_others_sessions(client, auth, fake_ai):
    sid = client.post("/chat/sessions", json={"title": "private"}, headers=auth).json()["id"]
    client.post(f"/chat/sessions/{sid}/messages", json={"content": "secret question"}, headers=auth)
    bob = register(client, email="bob@example.com", name="Bob")

    assert client.get("/chat/sessions", headers=bob).json() == []
    assert client.get(f"/chat/sessions/{sid}", headers=bob).status_code == 404
    assert client.post(f"/chat/sessions/{sid}/messages", json={"content": "hi"}, headers=bob).status_code == 404
    assert client.delete(f"/chat/sessions/{sid}", headers=bob).status_code == 404
    # Alice's conversation is untouched.
    assert len(client.get(f"/chat/sessions/{sid}", headers=auth).json()["messages"]) == 2


def test_delete_session_removes_messages(client, auth, fake_ai):
    from app.database import SessionLocal
    from app.models.chat import ChatMessage

    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    client.post(f"/chat/sessions/{sid}/messages", json={"content": "hello"}, headers=auth)
    assert client.delete(f"/chat/sessions/{sid}", headers=auth).status_code == 204
    assert client.get(f"/chat/sessions/{sid}", headers=auth).status_code == 404
    with SessionLocal() as db:
        assert db.query(ChatMessage).count() == 0


def test_ai_failure_saves_nothing(client, auth, monkeypatch):
    def boom(article, history, question):
        raise UpstreamError("The AI service returned an error. Please try again.")

    monkeypatch.setattr(ai_service, "generate_chat_reply", boom)
    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    res = client.post(f"/chat/sessions/{sid}/messages", json={"content": "hello"}, headers=auth)
    assert res.status_code == 502
    assert client.get(f"/chat/sessions/{sid}", headers=auth).json()["messages"] == []


def test_message_validation(client, auth, fake_ai):
    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    for content in ["", "   ", "x" * 2001]:
        res = client.post(f"/chat/sessions/{sid}/messages", json={"content": content}, headers=auth)
        assert res.status_code == 422


def test_rate_limit(client, auth, fake_ai, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "RATE_LIMIT_ENABLED", True)
    sid = client.post("/chat/sessions", json={}, headers=auth).json()["id"]
    codes = [client.post(f"/chat/sessions/{sid}/messages", json={"content": "hi"}, headers=auth).status_code for _ in range(22)]
    assert codes[0] == 201 and codes[-1] == 429
