from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.database import get_db
from app.models.user import User
from app.schemas.chat import (
    MessageCreate,
    MessageOut,
    SendMessageResponse,
    SessionCreate,
    SessionDetail,
    SessionOut,
)
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return chat_service.session_to_out(chat_service.create_session(db, user, payload.article_id, payload.title))


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [chat_service.session_to_out(s) for s in chat_service.list_sessions(db, user)]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = chat_service.get_owned_session(db, user, session_id)
    out = chat_service.session_to_out(session)
    return SessionDetail(**out.model_dump(), messages=[MessageOut.model_validate(m) for m in session.messages])


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("chat", max_requests=20, window_seconds=60))],
)
def send_message(
    session_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = chat_service.get_owned_session(db, user, session_id)
    user_msg, assistant_msg = chat_service.send_message(db, session, payload.content)
    return SendMessageResponse(
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
        session=chat_service.session_to_out(session),
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = chat_service.get_owned_session(db, user, session_id)
    db.delete(session)
    db.commit()
    return Response(status_code=204)
