from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings
from tests.conftest import register


def test_register_login_and_me(client):
    headers = register(client)
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["email"] == "alice@example.com"
    assert "password" not in me.text

    login = client.post("/auth/login", json={"email": "ALICE@example.com", "password": "password123"})
    assert login.status_code == 200 and login.json()["token_type"] == "bearer"


def test_password_is_hashed_in_database(client):
    from app.database import SessionLocal
    from app.models.user import User

    register(client)
    with SessionLocal() as db:
        user = db.query(User).one()
        assert user.password_hash != "password123" and user.password_hash.startswith("$argon2")


def test_duplicate_email_rejected(client):
    register(client)
    res = client.post("/auth/register", json={"name": "B", "email": "alice@example.com", "password": "password123"})
    assert res.status_code == 409


def test_register_validation(client):
    bad = [
        {"name": "A", "email": "not-an-email", "password": "password123"},
        {"name": "A", "email": "a@example.com", "password": "short1"},
        {"name": "A", "email": "a@example.com", "password": "onlyletters"},
        {"name": " ", "email": "a@example.com", "password": "password123"},
    ]
    for payload in bad:
        assert client.post("/auth/register", json=payload).status_code == 422


def test_wrong_password_and_unknown_user_give_same_error(client):
    register(client)
    wrong = client.post("/auth/login", json={"email": "alice@example.com", "password": "nope-nope-1"})
    unknown = client.post("/auth/login", json={"email": "ghost@example.com", "password": "password123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_protected_route_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_expired_token_is_rejected(client):
    register(client)
    s = get_settings()
    expired = jwt.encode(
        {"sub": "1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, s.JWT_SECRET_KEY, algorithm=s.JWT_ALGORITHM
    )
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401 and "expired" in res.json()["detail"].lower()


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200 and res.json()["status"] == "ok"
