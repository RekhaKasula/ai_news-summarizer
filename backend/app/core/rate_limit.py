"""Tiny in-memory sliding-window rate limiter (per client IP + bucket name).

Good enough for a single server process. For multiple instances use a shared store such as Redis.
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import RateLimitedError

_hits: dict[tuple[str, str], deque] = defaultdict(deque)
_lock = threading.Lock()


def reset_rate_limits() -> None:
    with _lock:
        _hits.clear()


def rate_limit(name: str, max_requests: int, window_seconds: int = 60):
    """Build a FastAPI dependency allowing `max_requests` per `window_seconds`."""

    def dependency(request: Request) -> None:
        if not get_settings().RATE_LIMIT_ENABLED:
            return
        client = request.client.host if request.client else "unknown"
        key = (name, client)
        now = time.monotonic()
        with _lock:
            q = _hits[key]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= max_requests:
                raise RateLimitedError("Too many requests. Please slow down and try again shortly.")
            q.append(now)

    return dependency
