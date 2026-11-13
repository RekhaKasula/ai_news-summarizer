"""Text clean-up helpers for untrusted news text."""
import html
import re

_TAG_RE = re.compile(r"<[^>]+>")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_TRUNC_MARKER_RE = re.compile(r"\s*(\.\.\.|…)?\s*\[\d+\s+chars\]\s*$")
_WS_RE = re.compile(r"[ \t]+")


def clean_text(value: str | None) -> str | None:
    """Strip HTML tags/control characters and normalise whitespace. Returns None for empty text."""
    if not value:
        return None
    text = html.unescape(_TAG_RE.sub(" ", value))
    text = _CTRL_RE.sub("", text)
    text = _WS_RE.sub(" ", text).strip()
    return text or None


def strip_truncation_marker(value: str | None) -> str | None:
    """GNews cuts `content` and appends e.g. '... [1234 chars]'. Remove that marker."""
    if not value:
        return value
    return _TRUNC_MARKER_RE.sub("", value).strip() or None


def truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"
