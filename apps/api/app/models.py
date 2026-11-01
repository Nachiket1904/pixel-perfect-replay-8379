"""Import every model here so Alembic autogenerate and tests see the full schema."""

from app.modules.auth.models import RefreshToken
from app.modules.exercises.models import Exercise, Submission
from app.modules.progress.models import UserNodeProgress
from app.modules.roadmaps.models import Roadmap, RoadmapEdge, RoadmapNode
from app.modules.users.models import User

__all__ = [
    "Exercise",
    "Submission",
    "RefreshToken",
    "Roadmap",
    "RoadmapEdge",
    "RoadmapNode",
    "User",
    "UserNodeProgress",
]
