#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/ops/codex-wrap.sh "<commands you ran>"
#
# This script:
# - creates/updates a run log file under docs/ops/codex-runs/
# - captures your command transcript (best effort)
# - commits the run log into the current branch

REPO="${CODEX_REPO:-$(git remote get-url origin 2>/dev/null || echo "")}" 
BRANCH="${CODEX_BRANCH:-$(git branch --show-current 2>/dev/null || echo "unknown")}" 

export CODEX_REPO="$REPO"
export CODEX_BRANCH="$BRANCH"

LOG_FILE="$(node scripts/ops/codex-run-log.mjs start)"
echo "Run log: $LOG_FILE"

# Run the provided command(s)
set +e
OUTPUT="$(
  bash -lc "$*" 2>&1
)"
RC=$?
set -e

# Append output (truncate to avoid huge diffs; tune if you want)
MAX=4000
TRIMMED="$(echo "$OUTPUT" | tail -c "$MAX")"

echo "$TRIMMED" | node scripts/ops/codex-run-log.mjs append >/dev/null

# Mark end
export CODEX_STATUS=$([ "$RC" -eq 0 ] && echo "success" || echo "failure")
export CODEX_CI="${CODEX_CI:-unknown}"
export CODEX_PR_URL="${CODEX_PR_URL:-}"

# Best-effort PR URL detection (works if this branch has an open PR)
PR_URL="$(gh pr view --json url -q .url 2>/dev/null || true)"
if [ -n "$PR_URL" ]; then
  export CODEX_PR_URL="$PR_URL"
fi

# CI marker: allow caller to override; otherwise unknown
if [ -z "${CODEX_CI:-}" ]; then
  export CODEX_CI="unknown"
fi

node scripts/ops/codex-run-log.mjs end >/dev/null

# Commit run log (non-blocking)
git add "$LOG_FILE" >/dev/null 2>&1 || true
git commit -m "docs(ops): add codex run log" --no-verify >/dev/null 2>&1 || true

exit "$RC"
