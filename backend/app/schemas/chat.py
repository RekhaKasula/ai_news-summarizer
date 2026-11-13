from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SessionCreate(BaseModel):
    article_id: int | None = None
    title: str | None = Field(default=None, max_length=200)


class SessionOut(BaseModel):
    id: int
    title: str
    article_id: int | None = None
    article_title: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    created_at: datetime


class SessionDetail(SessionOut):
    messages: list[MessageOut]


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        return v


class SendMessageResponse(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut
    session: SessionOut
