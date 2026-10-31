"""CSRF protection for cookie auth.

Cookies are SameSite=Lax, which already blocks most cross-site POSTs. As a second layer,
any state-changing request that carries an Origin header must come from an allowed origin
(the frontend) or from the API itself (Swagger UI). Requests without Origin (curl, server
to server) carry no ambient browser cookies by accident, so they are allowed.
"""

from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.errors import error_body

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class OriginCheckMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowed_origins: list[str]) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.allowed = {o.rstrip("/") for o in allowed_origins}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin and origin != "null":
                # Same-origin calls (Swagger UI) are fine. Behind a proxy (Codespaces, Railway) the public
                # host arrives in X-Forwarded-Host; a cross-site page can't set that header without a CORS
                # preflight, which we don't allow, so it can't be used to bypass this check.
                origin_host = urlsplit(origin).netloc
                hosts = {request.headers.get("host"), request.headers.get("x-forwarded-host")}
                same_host = origin_host in hosts
                if origin.rstrip("/") not in self.allowed and not same_host:
                    return JSONResponse(
                        error_body("FORBIDDEN", "Request origin not allowed."), status_code=403
                    )
            elif origin == "null":
                return JSONResponse(error_body("FORBIDDEN", "Request origin not allowed."), status_code=403)
        return await call_next(request)
