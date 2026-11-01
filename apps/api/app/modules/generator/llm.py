"""LLM clients for the generator.

AnthropicClient calls the Messages API with structured outputs (output_config.format), so the
reply is JSON that matches OUTPUT_SCHEMA. Plain httpx keeps us independent of SDK versions.
Verify the request shape against the Claude docs when you change the model:
https://platform.claude.com/docs/en/build-with-claude/structured-outputs

FakeClient returns a canned roadmap built from the goal, for local development and tests.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.config import Settings, get_settings
from app.modules.generator.schemas import OUTPUT_SCHEMA

log = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


class LLMUnavailable(Exception):
    """The provider is off, down, slow or misconfigured. Not the learner's fault."""


class LLMRefused(Exception):
    """The model declined the request (stop_reason == "refusal")."""


@dataclass
class LLMResult:
    data: Any  # parsed JSON (validated by the caller)
    input_tokens: int
    output_tokens: int


class LLMClient(Protocol):
    async def generate(self, system: str, user: str) -> LLMResult: ...


class AnthropicClient:
    def __init__(self, settings: Settings) -> None:
        assert settings.anthropic_api_key is not None  # noqa: S101  (checked in Settings)
        self._key = settings.anthropic_api_key.get_secret_value()
        self._model = settings.llm_model
        self._max_tokens = settings.llm_max_tokens
        self._timeout = settings.llm_timeout_seconds

    async def generate(self, system: str, user: str) -> LLMResult:
        body = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],  # no prefill: Haiku 5.5 rejects it
            "output_config": {"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        }
        headers = {
            "x-api-key": self._key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.post(ANTHROPIC_URL, json=body, headers=headers)
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"request failed: {type(exc).__name__}") from exc
        if res.status_code != 200:
            # Never log the key; the body only has the provider's error message.
            log.warning("Anthropic API returned %s: %s", res.status_code, res.text[:500])
            raise LLMUnavailable(f"provider returned {res.status_code}")

        payload = res.json()
        usage = payload.get("usage") or {}
        tokens_in = int(usage.get("input_tokens", 0))
        tokens_out = int(usage.get("output_tokens", 0))
        if payload.get("stop_reason") == "refusal":
            raise LLMRefused()
        text = "".join(b.get("text", "") for b in payload.get("content", []) if b.get("type") == "text")
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Truncated (max_tokens) or malformed: let the caller treat it as invalid output.
            data = None
        return LLMResult(data=data, input_tokens=tokens_in, output_tokens=tokens_out)


class FakeClient:
    """Deterministic 9-topic roadmap. Topics mention the goal so you can tell runs apart."""

    async def generate(self, system: str, user: str) -> LLMResult:
        goal = user.split("Goal:", 1)[-1].split("\n", 1)[0].strip()[:40] or "your goal"
        if any(word in goal.lower() for word in ("cook", "cricket", "dance", "recipe")):
            return LLMResult({"is_tech_goal": False, "title": "n/a", "description": "", "nodes": [],
                              "edges": []}, 0, 0)  # fmt: skip
        steps = [
            ("foundations", "Programming foundations", "py-basics"),
            ("tooling", "Tools and environment", "py-envs"),
            ("core-concepts", "Core concepts", ""),
            ("data-handling", "Working with data", "py-pandas"),
            ("first-project", "First small project", ""),
            ("testing", "Testing and debugging", ""),
            ("intermediate", "Intermediate techniques", ""),
            ("deployment", "Sharing and deploying your work", ""),
            ("capstone", "Capstone project", ""),
        ]
        nodes = [
            {
                "key": key,
                "title": title,
                "summary": f"{title} for: {goal}.",
                "search_query": f"{title} tutorial",
                "estimated_hours": 4,
                "official_match": match,
            }
            for key, title, match in steps
        ]
        edges = [{"from": a[0], "to": b[0]} for a, b in zip(steps, steps[1:], strict=False)]
        data = {"is_tech_goal": True, "title": f"Roadmap: {goal}", "description": f"A path for {goal}.",
                "nodes": nodes, "edges": edges}  # fmt: skip
        return LLMResult(data=data, input_tokens=0, output_tokens=0)


class DisabledClient:
    async def generate(self, system: str, user: str) -> LLMResult:
        raise LLMUnavailable("generator disabled (LLM_PROVIDER=disabled)")


def get_llm() -> LLMClient:
    """FastAPI dependency. Tests override it with a scripted client."""
    settings = get_settings()
    if settings.llm_provider == "anthropic":
        return AnthropicClient(settings)
    if settings.llm_provider == "fake":
        return FakeClient()
    return DisabledClient()
