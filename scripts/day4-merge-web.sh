#!/usr/bin/env bash
# Day 4: bring the frontend repo into apps/web of this monorepo, keeping its git history.
# Usage (from the monorepo root):  bash scripts/day4-merge-web.sh
set -euo pipefail

WEB_REPO="${1:-https://github.com/Nachiket1904/pixel-perfect-replay-8379.git}"
BRANCH="${2:-main}"

[ -d apps ] && [ -d docs ] || { echo "Run this from the monorepo root (where apps/ and docs/ are)."; exit 1; }
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "You have uncommitted changes. Commit or stash them first."; exit 1
fi
if [ -f apps/web/package.json ]; then
  echo "apps/web already contains an app. Nothing to do."; exit 0
fi

# subtree add needs the folder to not exist yet (it only holds a .gitkeep from Day 1).
if git ls-files --error-unmatch apps/web >/dev/null 2>&1; then
  git rm -r -q apps/web
  git commit -q -m "chore: remove apps/web placeholder"
fi
rm -rf apps/web

git subtree add --prefix=apps/web "$WEB_REPO" "$BRANCH" -m "chore: import frontend into apps/web (history kept)"

# Lovable-only files. The monorepo's root .github/copilot-instructions.md replaces them.
git rm -r -q --ignore-unmatch apps/web/.github apps/web/.lovable apps/web/AGENTS.md apps/web/roadmap.md
git commit -q -m "chore: remove Lovable leftovers from apps/web" || true

echo "Done. apps/web now holds the frontend with its full history."
