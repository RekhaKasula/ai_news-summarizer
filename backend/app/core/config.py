"""Application settings, loaded from environment variables / backend/.env.

All configuration lives here so the rest of the code never reads os.environ directly.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # env_ignore_empty: a blank value in .env (e.g. "GEMINI_MODEL=") falls back to the default below
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True
    )

    DATABASE_URL: str = ""
    GNEWS_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    FRONTEND_URL: str = "http://localhost:5173"

    GNEWS_LANG: str = "en"
    GNEWS_COUNTRY: str = ""
    NEWS_PAGE_SIZE: int = 10
    NEWS_CACHE_TTL_SECONDS: int = 600
    SUMMARY_CONCURRENCY: int = 2
    AUTO_SUMMARIZE_LIMIT: int = 2
    CHAT_HISTORY_WINDOW: int = 10
    RATE_LIMIT_ENABLED: bool = True
    

    @property
    def sqlalchemy_database_url(self) -> str:
        """Hosted providers use postgres:// or postgresql://; we use the psycopg (v3) driver."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.FRONTEND_URL.split(",") if o.strip()]

    def validation_errors(self) -> list[str]:
        """Problems that make the server unable to run at all."""
        errors = []
        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is not set.")
        if not self.JWT_SECRET_KEY:
            errors.append("JWT_SECRET_KEY is not set.")
        elif len(self.JWT_SECRET_KEY) < 32:
            errors.append("JWT_SECRET_KEY must be at least 32 characters long.")
        return errors

    def warnings(self) -> list[str]:
        """Problems that only break individual features (reported to the user as 503 errors)."""
        warnings = []
        if not self.GNEWS_API_KEY:
            warnings.append("GNEWS_API_KEY is not set: fetching news will fail until you add it.")
        if not self.GROQ_API_KEY and not self.GEMINI_API_KEY:
            warnings.append("No AI provider API key is configured.")

        return warnings

@lru_cache
def get_settings() -> Settings:
    return Settings()

