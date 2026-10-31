# PadhLo With Us: rules for AI assistants

Roadmap-first learning platform for Indian CS/IT students and early-career devs. A learner types a goal
and gets a roadmap.sh-style roadmap with free resources, an in-browser editor, a Paper to Code Lab and a
GitHub repo visualizer. Solo founder, 30-day v1. Prefer the simplest thing that works.

## Repo
- `apps/web`: TanStack Start + TanStack Router, React 19, TS strict (`exactOptionalPropertyTypes`),
  Tailwind v4, shadcn/ui, React Query, `@xyflow/react` v12. Package manager: bun.
- `apps/api`: FastAPI modular monolith, SQLAlchemy 2 async + asyncpg, Alembic, Redis, uv.
- `infra/docker`: local Postgres (pgvector) + Redis. `docs/adr`: decisions. `packages/content`: curated content.

## Web rules
- Components never import mock data. Components -> hooks in `src/lib/queries.ts` -> `src/lib/api.ts`.
- Types in `src/lib/types.ts` are snake_case and mirror the API. Don't rename fields.
- Every data screen has loading, empty and error (with retry) states. Mobile-first (375px and 1280px).
- User/AI text: plain text or `<Markdown>` (`src/components/common/markdown.tsx`). Never `dangerouslySetInnerHTML`.
- External links: `target="_blank" rel="noopener noreferrer nofollow"`.
- Never put reference solutions, secrets or API keys in frontend code.
- Routes with children use index files (`roadmaps.index.tsx`, `roadmaps.$slug.index.tsx`).
- Never invent statistics, user counts, testimonials or logos.

## API rules
- Each module: `router.py` (HTTP only), `service.py` (logic), `models.py`, `schemas.py`. Register models in `app/models.py`.
- Errors: raise `AppError(code, message, status)`; response shape is `{"error": {"code","message","details"}}`.
- Validate input with Pydantic (`extra="forbid"` on write schemas). Never trust the client for grading, roles or limits.
- Auth via `CurrentUser` dependency; roles via `require_role(...)`. Tokens live only in httpOnly cookies.
- Rate-limit anything expensive or abusable with `app.core.ratelimit.hit`.
- Schema changes need an Alembic migration (`--rev-id 000N`); read the generated file before committing.
- Never log passwords, tokens or full request bodies.

## Before committing
- Web: `cd apps/web && bun run lint && bun run test && bun run build`
- API: `cd apps/api && uv run ruff check . && uv run alembic check && uv run pytest -q`
