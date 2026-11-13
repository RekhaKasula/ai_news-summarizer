from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str | None] = mapped_column(Text)  # excerpt returned by GNews (usually truncated)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    original_url: Mapped[str] = mapped_column(String(2048))
    # Normalised URL (no tracking params/fragment) used to detect duplicates.
    canonical_url: Mapped[str] = mapped_column(String(2048), unique=True, index=True)
    source: Mapped[str | None] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    key_points: Mapped[list | None] = mapped_column(JSON)
    # True only when we have more text than the short description.
    content_available: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
