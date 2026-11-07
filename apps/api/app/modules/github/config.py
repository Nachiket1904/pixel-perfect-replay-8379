from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class GitHubSettings(BaseSettings):
    """Settings for the repo visualizer. Read from the same env vars / .env as the main app."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    github_token: SecretStr | None = None  # fine-grained PAT, public repos read-only
    github_sync_ttl_minutes: int = 60  # re-analyze a repo at most once per hour
    github_analyze_limit_per_hour: int = 10  # per learner
    github_max_download_mb: int = 80  # tarball size cap (Render free has 512 MB RAM)
    redis_url: str = "redis://localhost:6379/0"


gh_settings = GitHubSettings()
