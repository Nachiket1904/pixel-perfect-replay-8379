# ADR 0003: Backend foundation and auth
Date: 2026-10-31 · Status: accepted

## Decisions
- Monorepo: the frontend moved into `apps/web` with `git subtree` (history kept). One Codespace, one CI.
- FastAPI + SQLAlchemy 2 async + asyncpg; Alembic migrations with readable ids (0001, 0002...).
- uv for Python deps (lockfile committed), bun for the web app.
- Local services via docker compose (pgvector/pgvector:pg17, redis:7). API runs with uvicorn --reload.
- Auth: email + password (Argon2id via pwdlib), JWT access token (15 min) + random refresh token
  (30 days, stored as SHA-256, rotated on every refresh, reuse revokes the whole family).
- Tokens only in httpOnly, SameSite=Lax cookies; refresh cookie scoped to /api/v1/auth.
- CSRF: SameSite=Lax + Origin allow-list on state-changing requests.
- Rate limits in Redis (fixed window): auth per IP and per email. Fails open if Redis is down.
- One error format: {"error": {"code", "message", "details"}}.

## Consequence for Day 7 (deploy)
Cookies must be first-party, so the browser must talk to the API on the SAME site as the web app.
Plan: the web app proxies /api/* to the API (dev: Vite proxy; prod: platform rewrite or a custom domain
with app.<domain> and api.<domain>). Do not call a *.railway.app URL directly from a *.vercel.app page.

## Rejected
- Tokens in localStorage (readable by any XSS).
- Clerk/Auth0 for v1 (fine choice, but cookie JWT is ~1 day of work and avoids per-user pricing later).
- Google/GitHub OAuth in v1 (moved to v2 list).
