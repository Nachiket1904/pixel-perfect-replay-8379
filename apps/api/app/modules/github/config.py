from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class GitHubSettings(BaseSettings):
    """Settings for the repo visualizer. Read from the same env vars / .env as the main app."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    github_token: SecretStr | None = None  # fine-grained PAT, public repos read-only
    github_max_commits: int = 300  # commits pulled from the default branch
    github_max_branches: int = 8  # extra branches to pull commits from
    github_branch_commits: int = 50  # commits per extra branch
    github_sync_ttl_minutes: int = 60  # re-sync a repo at most once per hour
    github_analyze_limit_per_hour: int = 10  # per learner
    redis_url: str = "redis://localhost:6379/0"


gh_settings = GitHubSettings()
