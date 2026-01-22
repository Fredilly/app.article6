# Codex Workflow (Run logs)

Goal: eliminate manual copy/paste of Codex output.

## How to use

**Tip:** create the PR early (before long runs). The wrapper auto-detects the PR URL and writes it into the run log. If no PR exists yet, the PR field will be empty.

Run your work through:

```bash
scripts/ops/codex-wrap.sh "<commands you ran>"
```

Examples:

```bash
scripts/ops/codex-wrap.sh "npm run ci"
```

```bash
scripts/ops/codex-wrap.sh "rg -n 'Roadmap' docs && npm run roadmap:gen"
```

## What it records
- branch + repo
- start/end timestamps
- command output (tail, truncated)
- npm run ci status
- PR URL (if provided via CODEX_PR_URL)

## Required file
Every PR must include a committed log at:

```
docs/ops/codex-runs/<DATE>_<branch>.md
```

You can override metadata with env vars:

```bash
CODEX_REPO=... CODEX_BRANCH=... CODEX_PR_URL=... CODEX_CI=pass \
  scripts/ops/codex-wrap.sh "..."
```
