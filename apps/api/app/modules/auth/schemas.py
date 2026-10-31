from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)

    _email = field_validator("email", mode="after")(_normalize_email)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Name can't be empty")
        return v

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        # Length matters most (NIST 800-63B). Just block the obvious ones.
        if v.lower() in {"password", "password1", "12345678", "123456789", "qwerty123", "iloveyou"}:
            raise ValueError("This password is too common")
        if v.strip() != v or not v.strip():
            raise ValueError("Password can't start or end with spaces")
        return v


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    _email = field_validator("email", mode="after")(_normalize_email)
