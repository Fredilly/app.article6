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

Acceptance
- Selecting a method shows version timeline
- Trust strip shows copy actions for hashes + source SHA
- Vercel green

## M3 — Evidence deep dive (2–4 days)
- Rules tab: searchable list, tag chips
- Rule drawer: rule id, text, tags, linked sections/anchors
- Document tab: sections outline tree; clicking highlights related rules

Acceptance
- At least one end-to-end “rule → evidence anchor” jump works

## M4 — Chat as Method Assistant (2–3 days)
- Guided prompts (8–12)
- Freeform optional
- Strict response format: Answer / Evidence / Assumptions / Next actions
- Only enabled for selected method+version

Acceptance
- Guided prompts produce grounded responses with evidence links

## M5 — GeoVista MVP (2–4 days)
- Verify Location CTA from method detail
- Map/pin or lat/lon input
- Mock API route first + fixtures
- “Method ↔ Site Fit” panel mapping checks to rule ids
- Export Verification Snapshot JSON

Acceptance
- Demo flow works without external dependencies (mocked)

## M6 — Real GeoVista wiring (later)
- /api/geovista/verify with env key
- caching, rate limit, error UX
- optional persistence of snapshots
