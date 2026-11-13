"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.routes import auth, chat, health, news

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs full request URLs at INFO level, and the GNews API key is part of that URL.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("app")

MAX_BODY_BYTES = 100_000


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    errors = settings.validation_errors()
    if errors:
        raise RuntimeError(
            "Invalid configuration:\n  - " + "\n  - ".join(errors) + "\nSee backend/.env.example."
        )
    for warning in settings.warnings():
        logger.warning(warning)
    yield


settings = get_settings()
app = FastAPI(
    title="AI News Summarizer API",
    version="1.0.0",
    description="Personalised news feed with AI summaries and article chat.",
    lifespan=lifespan,
)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request body too large."}, status_code=413)
    return await call_next(request)


# Added last = outermost, so even 413/401 responses carry CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # we use a Bearer header, not cookies
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_request: Request, exc: SQLAlchemyError):
    logger.error("Database error: %s", type(exc).__name__)
    return JSONResponse({"detail": "The database is temporarily unavailable. Please try again."}, status_code=503)


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", type(exc).__name__)
    return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(news.router)
app.include_router(chat.router)
