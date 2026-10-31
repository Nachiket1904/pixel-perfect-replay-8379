"""One error shape for the whole API: {"error": {"code", "message", "details"}}.

The frontend switches on `code` (see ApiErrorCode in the web app's types.ts).
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, details: Any = None
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class NotAuthenticated(AppError):
    def __init__(self, message: str = "Please log in.") -> None:
        super().__init__("NOT_AUTHENTICATED", message, status.HTTP_401_UNAUTHORIZED)


class RateLimited(AppError):
    def __init__(self, retry_after: int) -> None:
        super().__init__(
            "RATE_LIMITED",
            "Too many attempts. Please wait a minute and try again.",
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"retry_after": retry_after},
        )


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


_STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "NOT_AUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {}
        if isinstance(exc, RateLimited):
            headers["Retry-After"] = str(exc.details["retry_after"])
        return JSONResponse(
            error_body(exc.code, exc.message, exc.details), status_code=exc.status_code, headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Never echo the submitted input back (it may contain a password).
        details = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()
        ]
        return JSONResponse(
            error_body("VALIDATION_ERROR", "Some fields are invalid.", details),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "SERVER_ERROR")
        return JSONResponse(error_body(code, str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            error_body("SERVER_ERROR", "Something went wrong on our side."),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
