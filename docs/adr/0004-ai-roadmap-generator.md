# ADR 0004: AI roadmap generator

Status: accepted (Days 19-20)

## Decision
- Claude Haiku 5.5 (`claude-haiku-5-5`) via the Messages API with structured outputs
  (`output_config.format`, JSON schema), called with plain httpx (no SDK version coupling).
- The model writes only text: topics, summaries, search queries, prerequisites and an optional
  match to an official topic. **It never writes URLs.** Links come from our curated docs list,
  YouTube/freeCodeCamp search pages, or the matched official topic's hand-written resources.
- Output is untrusted: Pydantic validates 8-30 topics, unique keys, real edges, no cycles and no
  links/markup in any text. One corrected retry, then `GENERATION_FAILED`.
- Generated roadmaps are private to their owner (404 for everyone else).

## Limits (all server-side)
- 3 successful roadmaps per learner per IST day, counted in Postgres.
- 8 LLM calls per learner per day (Redis), so rejected goals can't run up costs.
- One generation at a time per learner (Redis lock, 120 s expiry).
- Global daily spend cap (`LLM_DAILY_BUDGET_USD`, default $2) from real token usage.
  Fails closed: if Redis is down, generation pauses.

## Consequences
- `LLM_PROVIDER=disabled|fake|anthropic`. Disabled/unavailable answers `GENERATOR_UNAVAILABLE`
  and the UI points to official roadmaps (the fallback in the plan).
- Prices in config must be updated when the model changes.
- v2: per-user generation history table, streaming progress, regenerate/edit a roadmap.
