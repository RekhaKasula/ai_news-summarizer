"""Chat business logic: ownership checks, history window, calling Gemini, saving messages."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import AppError
from app.models.article import Article
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat import SessionOut
from app.services import ai_service
from app.utils.text import truncate

DEFAULT_TITLE = "New conversation"


def session_to_out(session: ChatSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        title=session.title,
        article_id=session.article_id,
        article_title=session.article.title if session.article else None,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def get_owned_session(db: Session, user: User, session_id: int) -> ChatSession:
    """Load a session only if it belongs to `user`. Others get 404 (we do not reveal that it exists)."""
    session = db.scalar(
        select(ChatSession)
        .options(selectinload(ChatSession.article))
        .where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if session is None:
        raise AppError("Conversation not found.", 404)
    return session


def list_sessions(db: Session, user: User) -> list[ChatSession]:
    return list(
        db.scalars(
            select(ChatSession)
            .options(selectinload(ChatSession.article))
            .where(ChatSession.user_id == user.id)
            .order_by(ChatSession.updated_at.desc(), ChatSession.id.desc())
        )
    )


def create_session(db: Session, user: User, article_id: int | None, title: str | None) -> ChatSession:
    article = None
    if article_id is not None:
        article = db.get(Article, article_id)
        if article is None:
            raise AppError("Article not found.", 404)
    final_title = (title or "").strip() or (
        truncate(f"Chat: {article.title}", 80) if article else DEFAULT_TITLE
    )
    session = ChatSession(user_id=user.id, article_id=article_id, title=final_title)
    db.add(session)
    db.commit()
    db.refresh(session)
    session.article = article
    return session


def send_message(db: Session, session: ChatSession, content: str) -> tuple[ChatMessage, ChatMessage]:
    """Ask Gemini first; only if it answers do we save both messages (so failures can be retried cleanly)."""
    window = get_settings().CHAT_HISTORY_WINDOW
    recent = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(window)
        )
    )[::-1]
    history = [(m.role, m.content) for m in recent]

    article = session.article
    article_ctx = None
    if article is not None:
        article_ctx = {
            "title": article.title,
            "description": article.description,
            "content": article.content,
            "source": article.source,
            "published_at": article.published_at.isoformat() if article.published_at else None,
            "content_available": article.content_available,
        }

    asked_at = datetime.now(timezone.utc)
    reply = ai_service.generate_chat_reply(article_ctx, history, content)
    answered_at = datetime.now(timezone.utc)

    is_first = not history
    user_msg = ChatMessage(session_id=session.id, role="user", content=content, created_at=asked_at)
    assistant_msg = ChatMessage(session_id=session.id, role="assistant", content=reply, created_at=answered_at)
    db.add(user_msg)
    db.add(assistant_msg)
    session.updated_at = answered_at
    if is_first and session.title == DEFAULT_TITLE:
        session.title = truncate(content, 60)
    db.commit()
    return user_msg, assistant_msg
