import httpx

GITHUB_API = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class GitHubClient:
    """Read-only GitHub REST client. Paths are built only from validated owner/name values."""

    def __init__(self, token: str | None) -> None:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",  # check GitHub's REST docs for the current version
            "User-Agent": "padhlo-with-us",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._http = httpx.AsyncClient(base_url=GITHUB_API, headers=headers, timeout=15.0)

    async def __aenter__(self) -> "GitHubClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._http.aclose()

    async def _get(self, path: str, params: dict | None = None):
        try:
            r = await self._http.get(path, params=params)
        except httpx.HTTPError as e:
            raise GitHubError("upstream", "Could not reach GitHub. Try again shortly.") from e
        if r.status_code == 404:
            raise GitHubError("not_found", "Repository not found. Only public repositories are supported.")
        if r.status_code == 401:
            raise GitHubError("upstream", "GitHub rejected the server token.")
        if r.status_code == 429 or (r.status_code == 403 and r.headers.get("x-ratelimit-remaining") == "0"):
            raise GitHubError("rate_limited", "GitHub rate limit reached. Try again in a few minutes.")
        if r.status_code == 409:  # empty repository: no commits yet
            return []
        if r.status_code >= 400:
            raise GitHubError("upstream", f"GitHub returned an error ({r.status_code}).")
        return r.json()

    async def repo(self, owner: str, name: str) -> dict:
        return await self._get(f"/repos/{owner}/{name}")

    async def branches(self, owner: str, name: str) -> list[dict]:
        return await self._get(f"/repos/{owner}/{name}/branches", {"per_page": 100})

    async def tags(self, owner: str, name: str) -> list[dict]:
        return await self._get(f"/repos/{owner}/{name}/tags", {"per_page": 100})

    async def releases(self, owner: str, name: str) -> list[dict]:
        return await self._get(f"/repos/{owner}/{name}/releases", {"per_page": 100})

    async def commits(self, owner: str, name: str, ref: str, limit: int) -> list[dict]:
        out: list[dict] = []
        page = 1
        while len(out) < limit:
            batch = await self._get(
                f"/repos/{owner}/{name}/commits", {"sha": ref, "per_page": 100, "page": page}
            )
            if not batch:
                break
            out.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        return out[:limit]
