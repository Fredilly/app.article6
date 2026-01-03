# UI Roadmap: TrustStrip Investor Polish

## Goal
Make provenance/audit trust feel **business-native** (not dev tooling) while remaining **fully verifiable**.

The UI should:
- communicate *what this is* (dataset release, freshness, evidence bundle)
- hide technical complexity behind plain language
- keep deep technical provenance available, but secondary

## Current State
TrustStrip exists and is functional:
- thin default row (source + generated + Export/Details)
- Details shows pack/repo/hashes and supports copy/export

Problem:
- Details reads like developer debug output (raw keys like `rules_sha256`).
- Provenance signals aren’t framed in business meaning (audit-ready, reproducible snapshot).

## Design Principles
- **Progressive disclosure:** show meaning first, details on demand.
- **Business semantics over implementation fields:** "Rules fingerprint" not `rules_sha256`.
- **One primary action:** Export the evidence bundle.
- **Secondary technical detail:** GitHub repo@sha and raw hashes are never the first thing a viewer sees.
- **Apple-like cleanliness:** minimal labels, calm typography, tight spacing, no “JSON-y” feel.

## Proposed IA (Information Architecture)

### TrustStrip (default row)
Keep the row extremely thin and stable:
- `source: Article6 Methodologies`
- `generated: <timestamp>`
- Buttons: `Export` (primary), `Details` (secondary)

Optional (only if it stays clean):
- `release: <short pack id>` (e.g., `3ea9dc32bfaf`)

### Details panel (investor-first)
Replace raw fields with 3 sections:

1) **Dataset**
- Source: Article6 Methodologies
- Release: methodologies-pack-<short>
- Generated: <timestamp>

2) **Audit fingerprints** (collapsed by default)
- Rules fingerprint
- Sections fingerprint
- Source PDF fingerprint
Actions:
- Copy all fingerprints (single click)

3) **Technical provenance** (tertiary)
- GitHub: <owner>/<repo>@<sha>
- Pack tag: <tag>
Action:
- Copy technical provenance

## Execution Plan (post-merge PR)
### Tasks
- Replace Details field labels with business-friendly labels
- Group Details rows into the 3 sections above
- Collapse “Audit fingerprints” by default
- Keep copy actions but remove per-row “Copy” spam:
  - prefer: one “Copy all” per section
  - optionally: a subtle copy icon per row on hover
- Ensure keyboard + screen reader friendly interactions

### Acceptance Criteria
- Default UI shows no raw hash keys (no `*_sha256` labels).
- Investor can understand: **what dataset**, **how fresh**, **how to export** in <10 seconds.
- Auditor/engineer can still access raw hashes + repo@sha within 1 click.
- No duplication of provenance surfaces.

### Visible UI changes (when implemented)
- Details popover becomes a clean, sectioned layout.
- “Audit fingerprints” appear as a collapsed group with a single copy action.
- GitHub/repo info becomes a secondary “Technical provenance” section.

## Out of Scope (for this polish PR)
- Method Assistant
- Rich evidence rendering improvements
- Diff UI
- GeoVista integration

