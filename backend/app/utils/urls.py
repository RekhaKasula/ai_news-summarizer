"""URL validation and canonicalisation (used to de-duplicate articles)."""
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

MAX_URL_LENGTH = 2048
_TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid", "cmpid"}


def is_valid_http_url(url: str | None) -> bool:
    """Only absolute http(s) URLs are accepted (blocks javascript:, data:, file: ...)."""
    if not url or len(url) > MAX_URL_LENGTH:
        return False
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return False
    return parts.scheme in ("http", "https") and bool(parts.hostname)


def canonicalize_url(url: str) -> str | None:
    """Lower-case host, drop fragment/tracking params/default ports/trailing slash. None if invalid."""
    if not is_valid_http_url(url):
        return None
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    port = parts.port
    if port and not ((parts.scheme == "http" and port == 80) or (parts.scheme == "https" and port == 443)):
        host = f"{host}:{port}"
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAMS
    ]
    path = parts.path.rstrip("/") or "/"
    canonical = urlunsplit((parts.scheme, host, path, urlencode(sorted(query)), ""))
    return canonical if len(canonical) <= MAX_URL_LENGTH else None
