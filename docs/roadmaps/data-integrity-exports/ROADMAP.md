> ⚠️ **DEPRECATED**: This roadmap is not canonical.  
> Go to: `docs/projects/ROADMAP.md`

# New Roadmap: Phase — Data Integrity + Exports (Sellable Core)

## Goals (Definition of Done)

- Deterministic outputs: same inputs => byte-identical exports
- Validated artifacts: every shipped JSON validates against a schema
- Auditable exports: downloadable pack with hashes + provenance
- Traceability: rule <-> section <-> evidence pointers are computable and exportable
- UI trust signals: minimal UI changes that surface integrity, not "more UI"

---

## Workstream A — Integrity Contract (foundation)

### PR7 — Data Contract + Validators

Scope

- Define a shared "data contract" for:
  - registry.json
  - META.json
  - rules.json, sections.json
  - *.rich.json variants
- Add canonical JSON rules (ordering, normalization) so hashing is stable
- Add sha256 generation utilities
- Add CI gates: validate + hash + fail on drift

Acceptance

- CI fails if any artifact is invalid or non-canonical
- Hashes are reproducible across runs

Visible UI changes to look for

- None (backend/CI only)

---

## Workstream B — Deterministic Export Pipeline (sellable artifact)

### PR8 — Audit Pack Export (the "investor download")

Scope

- Add export generator that produces:
  - audit-pack.zip (global / curated)
  - (optional) method-pack.zip per method/version
- Pack contents:
  - methodology JSONs (META/rules/sections/rich)
  - registry.json (or slice)
  - manifest.json (hashes for every file + provenance: repo, commit sha, generated_at policy, tool versions)

Acceptance

- Downloadable zip builds successfully and matches manifest hashes
- Manifest includes enough provenance to reproduce/verify

Visible UI changes to look for

- New "Download audit pack" button (likely in Trust Strip / header of relevant view)
- Clicking it downloads a zip

---

### PR9 — Export Verification + Idempotency Gate

Scope

- CI runs export twice and asserts byte-identical output
- Fail build on any diff (timestamps, ordering, compression nondeterminism, etc.)
- Add a lightweight snapshot or lockfile for expected export structure (as needed)

Acceptance

- "Export drift" cannot pass CI
- Export is deterministic in CI and local (devcontainer)

Visible UI changes to look for

- Trust strip / trust console shows "Export: Verified ✅" (or "Drift ❌" in dev)

---

## Workstream C — Traceability (turn data into instant answers)

### PR10 — Traceability Index (Rule <-> Section <-> Evidence)

Scope

- Generate trace.json derived index:
  - rule_id -> sections[] -> anchors/page refs -> citations -> evidence-layer ids
- Include trace.json in audit pack
- Make it queriable by the app (local + deployed)

Acceptance

- Given a rule, app can show linked sections/evidence without fuzzy heuristics
- Trace export is deterministic + validated

Visible UI changes to look for

- Rule view gains a small block: "Linked Sections / Evidence" (fast jump links)

---

## Workstream D — "What Changed?" (optional wow factor)

### PR11 — Integrity Diff (manifest-to-manifest)

Scope

- Compare export manifests across commits/builds
- Produce a compact diff summary: added/removed/changed files + hashes

Acceptance

- One place to answer "what changed?" without eyeballing JSON

Visible UI changes to look for

- Trust console shows "Changes since last build" with counts + click-to-view

---

## Sequencing (highest leverage path)

1. PR7 (contract) -> makes everything enforceable
2. PR8 (audit pack) -> makes it sellable immediately
3. PR9 (idempotency) -> makes it reliable at scale
4. PR10 (trace) -> makes demos crisp + product sticky
5. PR11 (diff) -> makes iterations investor-friendly
