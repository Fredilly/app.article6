# PR20 — Trail inside audit pack + strict verify

## Scope
- Include `trail.jsonl` in every audit-pack export.
- Enforce strict verification: manifest required, no extras, all hashes match, trail validated.

## Trail format
- JSONL, one object per line.
- Required fields: `ts` (ISO timestamp), `actor` (string), `action` (string).
- Export always includes at least a `trail.init` entry.

## Strict verify rules
- `manifest.json` must exist and list all files.
- `trail.jsonl` must exist and be listed in the manifest.
- Any missing/extra files or hash mismatches fail verification.
- Invalid JSON lines or missing required trail fields fail verification.

## Determinism notes
- Manifest file list sorted by path.
- Zip entries sorted by path.
- Canonical JSON for structured files; newline at EOF.

## Failure modes (examples)
- Missing trail.jsonl → fail.
- Tampered trail.jsonl line → fail.
- Zip contains file not in manifest → fail.
