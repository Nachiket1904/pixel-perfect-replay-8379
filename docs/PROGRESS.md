# Progress log

Day 1 — Done: persona locked, roadmap-first product (no courses), design brief + ADR 0001, monorepo pushed.
Blocked: domain deferred to v2 list.
Next: Day 2 — screens part 1.

Day 2 — Done: Lovable foundation (TanStack Start, ADR 0002); landing, Build my roadmap, catalog, roadmap view (React Flow + list) on mock data; moved to Codespaces + Copilot.
Blocked: Lovable credits exhausted (no longer needed).
Next: Day 3 — remaining screens.

Day 3 — Done: topic page, dashboard, paper search, paper detail, implementation player (mock data, safe Markdown, no solutions client-side).
Blocked: none.
Next: Day 4 — monorepo, CI, devcontainer.

Day 4 — Done: frontend repo became the monorepo; frontend moved into apps/web with git mv; CI (web + api); devcontainer.
Blocked: none.
Next: Day 5 — API scaffold.

Day 5 — Done: FastAPI modular monolith, compose (Postgres + Redis), Alembic 0001, /health, error format, Dockerfile.
Blocked: none.
Next: Day 6 — auth.

Day 6 — Done: register/login/refresh/logout + /users/me; Argon2id, httpOnly cookies, rotating refresh tokens, rate limits, CSRF origin check; 19 API tests. ADR 0003.
Blocked: cookies need same-site → proxy /api through the web app (or buy a domain) before deploy.
Next: Day 7 — login/signup UI, dev proxy, first staging deploy.
