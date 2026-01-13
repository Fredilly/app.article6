# Roadmap

## M0 — Baseline + scope lock (0.5 day)
- Confirm current /manifest route and data sources
- Capture screenshots of current state
- Define “done” for investor demo

Acceptance
- Roadmap checked in
- No code changes yet

## M1 — Methods-first inventory (1–2 days)
- /manifest defaults to method inventory table/list (NOT rules)
- Columns: Code, Program, Sector, Latest, Versions, Rules, Flags (Rich/Previous)
- Search + filters operate on methods inventory

Acceptance
- Page loads fast
- No rule rows shown until method selected
- Mobile list works (tap targets)

## M2 — Method detail panel + tabs (2–3 days)
- Desktop two-panel layout OR list + detail pane
- Tabs: Overview, Versions, Rules, Document, Rich
- Trust strip on Overview (repo SHA, generated_at, hashes, export)
- Stable URLs preserve selected method+version + active tab

Acceptance
- Selecting a method shows version timeline
- Trust strip shows copy actions for hashes + source SHA
- Copy/paste URL restores the same tab + selection (no resets when switching tabs)
- Vercel green

## M3 — Evidence deep dive (2–4 days)
- Rules tab: searchable list, tag chips
- Rule drawer: rule id, text, tags; linked sections/anchors
- Document tab: outline tree with deep links; cross-highlighting between rules ↔ sections
- Rich tab: show extracted evidence, deltas, and citations (if available)

Acceptance
- At least one end-to-end “rule → evidence anchor” jump works
- Cross-highlighting is obvious and non-breaking

## M4 — Chat as Method Assistant (2–3 days)
- Guided prompts (8–12)
- Freeform optional
- Strict response format: Answer / Evidence / Assumptions / Next actions
- Only enabled for selected method+version

Acceptance
- Guided prompts produce grounded responses with evidence links

## M5 — Evidence Map integration (2–4 days)
- “View evidence map” CTA from Method+Version detail (only enabled when method+version selected)
- Inputs: STAC URL (preferred) OR GeoJSON upload; optional AOI polygon + date range
- Outputs: render overlays + metadata; Rule ↔ Evidence traceability (rule IDs + section anchors)
- Trust strip shows provenance + exact evidence-layer identifier (URL or content hash)
- Export “Evidence Snapshot” JSON (method+version, AOI, layer refs, selected features, hashes)
- Non-goal: no pass/fail verification claims unless backed by explicit rule text + evidence links

Acceptance
- Evidence map loads and renders from STAC URL and from GeoJSON upload
- Selecting a feature shows its linked rule IDs / section anchors (when present)
- Exported Evidence Snapshot is stable and reproducible for the same inputs

---

## Definition of Done (Investor Demo)
1) Pick method+version → view Trust Strip
2) Open a rule
3) Jump to evidence anchor
4) View evidence map overlay
5) Export Evidence Snapshot / audit pack

## WHAT
- Update roadmap to remove verification-specific milestones and align to Evidence Map integration + current IA.

## WHY
- Keep investor-demo scope consistent with the system prompt (evidence-centric, no verification product claims).

Signed-off-by: Fred E <fredilly@article6.org>

---

## Phase: Data Integrity + Exports (sellable packaging)

### Export scopes (product tiers)
- **Tier 0 — Method pack**: methodology bundle only (META/rules/sections + rich) → Free / Starter
- **Tier 1 — Method pack + pack meta**: add `pack.meta.json` provenance/exporter info → Pro
- **Tier 2 — Session pack**: AOI upload + STAC query/results + selections (later verification output) → Team / Pro+
- **Tier 3 — Verification + diffs**: verification outputs + manifest-to-manifest diff/change control → Enterprise

### Sequencing (highest leverage)
1. **PR8** — method-pack export + download endpoint
2. **PR8.1** — add `pack.meta.json` (+ optional `registry.json` when present)
3. **PR9** — determinism gate (build twice ⇒ byte-identical zip)
4. **PR10** — session-pack (“run evidence”: AOI + evidence outputs)
5. **PR11** — diff: manifest-to-manifest comparison (what changed + why)

### Acceptance / visible markers
- PR8: download yields `manifest.json` + 5 method files
- PR8.1: zip also includes `pack.meta.json`; `manifest.files` includes it
- PR9: two exports for same commit are byte-identical (sha256 matches)
- PR10: zip includes `snapshot/aoi.json` + `snapshot/evidence.query.json` + `snapshot/evidence.results.json`
- PR11: diff report lists added/removed/changed files + sha changes

### Audit Pack Quality Gates
- Local smoke test (dev server required): `npm run test:audit-pack:smoke`
- Preview smoke test: `BASE_URL=https://<preview>.vercel.app npm run test:audit-pack:smoke`

### Merge Gates
- Local parity gate: `npm run pr:gate`
- CI gate: `.github/workflows/pr-gate.yml` (build + test + lint + audit-pack smoke)
