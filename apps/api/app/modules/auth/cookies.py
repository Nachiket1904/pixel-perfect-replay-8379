from fastapi import Response

from app.core.config import get_settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
# The refresh cookie is only sent to auth endpoints, never to the rest of the API.
REFRESH_PATH = "/api/v1/auth"


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    s = get_settings()
    common = {"httponly": True, "secure": s.cookie_secure, "samesite": "lax", "domain": s.cookie_domain}
    response.set_cookie(ACCESS_COOKIE, access, max_age=s.access_token_ttl_minutes * 60, path="/", **common)
    response.set_cookie(
        REFRESH_COOKIE, refresh, max_age=s.refresh_token_ttl_days * 86400, path=REFRESH_PATH, **common
    )


def clear_auth_cookies(response: Response) -> None:
    s = get_settings()
    common = {"httponly": True, "secure": s.cookie_secure, "samesite": "lax", "domain": s.cookie_domain}
    response.delete_cookie(ACCESS_COOKIE, path="/", **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH, **common)
