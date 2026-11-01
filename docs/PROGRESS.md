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
Day 7 — Done: login/signup UI, auth hooks, same-origin /api proxy (dev + prod), safe redirects; 7 web tests. Blocked: staging deploy pending (Neon + Railway accounts). Next: Day 8.
Day 8 — Done: roadmap tables (0002), content in packages/content with graph validation, idempotent seed; 2 official roadmaps. Blocked: none. Next: Day 9.
Day 9 — Done: GET /roadmaps + /roadmaps/{slug}, optional auth, private = 404, access-cookie lifetime fix; catalog on real data; 40 API tests. Blocked: status toggles wait for Day 11. Next: Day 10 topic page.
Day 11 — Done: per-user node progress (0003), PUT progress with auth/visibility/rate limit, statuses on roadmap/topic/catalog. Blocked: none. Next: Day 12.
Day 12 — Done: /users/me/dashboard with next topic and IST streak; dashboard on real data with streak card; 60 API + 33 web tests. Blocked: staging deploy still pending. Next: Day 13.
Day 13 — Done: content and resources for all 22 official topics, with a test against fallbacks. Blocked: links need a manual click-check. Next: Day 14 deploy, then Day 15 editor (code written, verification pending).
Day 14 — Done: browser check at 375/1280; fixed pre-hydration password-in-URL bug. Blocked: staging deploy still pending (Neon + Railway). Next: deploy, then Day 15.
Day 15 — Done: Monaco CodeEditor (lazy, themes, reset, run/stop, Ctrl+Enter), local drafts, scratchpad on topic pages; 60 API + 36 web tests. Blocked: none. Next: Day 16, Pyodide in a Web Worker so Run actually runs Python.
Day 16. Done: Pyodide worker with streamed output, 10-second limit, Stop, network blocked for learner code; runner on topic pages. Blocked: staging deploy still pending. Next: Day 17.
Day 17. Done: exercises and submissions (0004), submission API (unverified, consistency checks, rate limit), 2 exercises with a CI check on solutions, Check flow with results and restore; 80 API and 50 web tests. Blocked: none. Next: package patches, then Day 18 (hints, show solution after 3 attempts, 4+ exercises).
Day 18 — Done: hints one at a time, solution after 3 attempts (server-enforced), solving marks topic done, exercises on 5 topics. Blocked: none. Next: Day 19.
Day 19 — Done: AI generator backend (Haiku 5.5 structured outputs, strict validation + retry, official matches, backend-built links, private save, fake/disabled providers); ADR 0004. Blocked: needs ANTHROPIC_API_KEY for real runs. Next: Day 20.
Day 20 — Done: 3/day quota, 8 attempts/day, per-user lock, $2/day spend cap (fails closed), Build page on real API, mock fallbacks removed; 116 API + 56 web tests. Blocked: staging deploy still pending. Next: Day 21 deploy + buffer.