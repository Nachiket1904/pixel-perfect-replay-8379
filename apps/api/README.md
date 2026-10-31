# PadhLo API

FastAPI modular monolith. Python 3.12, SQLAlchemy 2 (async) + asyncpg, Alembic, Redis, uv.

## Run locally
```bash
docker compose -f ../../infra/docker/docker-compose.yml up -d   # Postgres + Redis
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```
Swagger UI: http://localhost:8000/docs · Health: http://localhost:8000/health

## Checks (same as CI)
```bash
uv run ruff check . && uv run ruff format --check .
uv run alembic check        # models and migrations agree
uv run pytest -q            # uses the padhlo_test database
```

## New migration
```bash
uv run alembic revision --autogenerate -m "add roadmaps" --rev-id 0002
```
Always read the generated file before committing. Autogenerate misses things like enum drops and data changes.

## Layout
- `app/core`: config, db, security, errors, rate limits, CSRF origin check
- `app/modules/<name>`: router.py (HTTP), service.py (logic), models.py (tables), schemas.py (Pydantic)
- Register every new model in `app/models.py` so Alembic sees it.

## Auth model
httpOnly cookies, never tokens in JS. `access_token` (15 min JWT, path `/`), `refresh_token`
(30 days, random, stored hashed, path `/api/v1/auth`). Refresh rotates the token; reusing an old one
revokes the whole login family. Writes from a foreign Origin get 403. Login is rate limited per IP
and per email.
