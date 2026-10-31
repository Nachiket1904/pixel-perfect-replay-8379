"""Import every model here so Alembic autogenerate and tests see the full schema."""

from app.modules.auth.models import RefreshToken
from app.modules.users.models import User

__all__ = ["RefreshToken", "User"]
