from urllib.parse import quote

import httpx

GITHUB_API = "https://api.github.com"


class GitHubError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class GitHubClient:
    """Read-only GitHub client. Paths are built only from validated owner/name values."""

    def __init__(self, token: str | None) -> None:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",  # check GitHub's REST docs for the current version
            "User-Agent": "padhlo-with-us",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        # httpx drops the Authorization header when a redirect goes to another host (codeload).
        self._http = httpx.AsyncClient(
            base_url=GITHUB_API, headers=headers, timeout=30.0, follow_redirects=True
        )

    async def __aenter__(self) -> "GitHubClient":
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._http.aclose()

    @staticmethod
    def _check(r: httpx.Response) -> None:
        if r.status_code == 404:
            raise GitHubError("not_found", "Repository not found. Only public repositories are supported.")
        if r.status_code == 401:
            raise GitHubError("upstream", "GitHub rejected the server token.")
        if r.status_code == 429 or (r.status_code == 403 and r.headers.get("x-ratelimit-remaining") == "0"):
            raise GitHubError("rate_limited", "GitHub rate limit reached. Try again in a few minutes.")
        if r.status_code == 409:
            raise GitHubError("empty", "This repository is empty.")
        if r.status_code >= 400:
            raise GitHubError("upstream", f"GitHub returned an error ({r.status_code}).")

    async def _get(self, path: str, **kwargs) -> httpx.Response:
        try:
            r = await self._http.get(path, **kwargs)
        except httpx.HTTPError as e:
            raise GitHubError("upstream", "Could not reach GitHub. Try again shortly.") from e
        self._check(r)
        return r

    async def repo(self, owner: str, name: str) -> dict:
        return (await self._get(f"/repos/{owner}/{name}")).json()

    async def head_sha(self, owner: str, name: str, ref: str) -> str:
        r = await self._get(
            f"/repos/{owner}/{name}/commits/{quote(ref, safe='')}",
            headers={"Accept": "application/vnd.github.sha"},
        )
        return r.text.strip()

    async def tarball(self, owner: str, name: str, sha: str, max_bytes: int) -> bytes:
        """Downloads the repo snapshot at `sha`, aborting once it grows past max_bytes."""
        chunks: list[bytes] = []
        size = 0
        try:
            async with self._http.stream("GET", f"/repos/{owner}/{name}/tarball/{sha}") as r:
                self._check(r)
                async for chunk in r.aiter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise GitHubError(
                            "too_large",
                            "This repository is too large for the visualizer "
                            f"(over {max_bytes // 1_000_000} MB).",
                        )
                    chunks.append(chunk)
        except httpx.HTTPError as e:
            raise GitHubError("upstream", "Download from GitHub failed. Try again shortly.") from e
        return b"".join(chunks)

    async def file_text(self, owner: str, name: str, path: str, sha: str, max_bytes: int) -> tuple[str, bool]:
        r = await self._get(
            f"/repos/{owner}/{name}/contents/{quote(path)}",
            params={"ref": sha},
            headers={"Accept": "application/vnd.github.raw+json"},
        )
        data = r.content
        truncated = len(data) > max_bytes
        return data[:max_bytes].decode("utf-8", errors="replace"), truncated
