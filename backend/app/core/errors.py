"""Custom HTTP errors. They subclass HTTPException so FastAPI renders them as {"detail": "..."}."""
from fastapi import HTTPException


class AppError(HTTPException):
    status_code_default = 400

    def __init__(self, detail: str, status_code: int | None = None):
        super().__init__(status_code=status_code or self.status_code_default, detail=detail)


class ConfigurationError(AppError):
    """A required key/setting is missing or invalid on the server."""
    status_code_default = 503


class UpstreamError(AppError):
    """GNews or Gemini failed or was unreachable."""
    status_code_default = 502


class RateLimitedError(AppError):
    """Our own limiter, or an upstream quota, was hit."""
    status_code_default = 429
