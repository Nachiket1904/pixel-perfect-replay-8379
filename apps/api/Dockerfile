# Production image for Railway / Fly. Local dev runs `uv run uvicorn ... --reload` instead.
FROM python:3.12-slim

# uv binary from the official image (pin a minor version; check https://docs.astral.sh/uv/ for the latest)
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first so this layer is cached when only app code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY . .
RUN uv sync --locked --no-dev

# Never run as root.
RUN useradd --system --no-create-home app
USER app

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# Migrations on boot are fine while there is ONE instance. With several instances, move
# `alembic upgrade head` to a release/pre-deploy step instead.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
