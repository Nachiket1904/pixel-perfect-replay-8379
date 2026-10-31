from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_PREFIX = "dev-only"  # noqa: S105  (marker, not a secret)


def normalize_database_url(url: str) -> str:
    """Accept the URLs Neon/Railway hand out and make them work with SQLAlchemy + asyncpg.

    - postgres:// or postgresql://  ->  postgresql+asyncpg://
    - asyncpg doesn't understand ?sslmode=require or channel_binding, so convert/drop them.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url.removeprefix("postgresql://")

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode in {"require", "verify-ca", "verify-full"}:
        query["ssl"] = "require"
    return urlunsplit(parts._replace(query=urlencode(query)))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: Literal["local", "test", "staging", "production"] = "local"
    app_name: str = "PadhLo With Us API"

    database_url: str = "postgresql+asyncpg://padhlo:padhlo@localhost:5432/padhlo"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "padhlo-api"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # Browser origins allowed to call the API (CORS) and to send cookie-authenticated writes (CSRF check).
    cors_origins: list[str] = ["http://localhost:8080"]
    cookie_secure: bool = False
    cookie_domain: str | None = None

    # Rate limits (per window of 60s)
    auth_ip_limit_per_minute: int = 10
    login_email_limit_per_minute: int = 5

    @field_validator("database_url")
    @classmethod
    def _normalize_db(cls, v: str) -> str:
        return normalize_database_url(v)

    @field_validator("jwt_secret")
    @classmethod
    def _secret_length(cls, v: SecretStr) -> SecretStr:
        if len(v.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if self.env in {"staging", "production"}:
            if self.jwt_secret.get_secret_value().startswith(DEV_SECRET_PREFIX):
                raise ValueError("Set a real JWT_SECRET outside local development")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true outside local development")
        return self

    @property
    def is_dev(self) -> bool:
        return self.env in {"local", "test"}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env / .env
