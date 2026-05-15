# Standard Registry Wiring

Status SSOT: `docs/roadmaps/standard-registry-wiring/phase-status.json`

Tags for PR bodies and commit messages:
- `Roadmap: standard-registry-wiring`
- `Roadmap-Item: <phase_id>` (e.g. `Roadmap-Item: phase_0_contract_and_boundaries`)
- `SSOT: docs/roadmaps/standard-registry-wiring/phase-status.json`

## Goal

Wire Verra and Gold Standard into the app through a safe, incremental, standard-aware path:

- UNFCCC remains unchanged throughout.
- Verra and Gold Standard are wired through the same standard-aware path.
- The app consumes methodology metadata from the pack/manifest — no hand-stitched entries.
- UI makes the selected standard obvious at a glance.
- PDF/export output is premium, truthful, and does not show fallback/stub wording.
- Standard-specific composers (Verra-specific sections, Gold Standard-specific sections) come later, after the generic standard-aware path works and upstream metadata supports registry-specific structuring.

## Non-goals

- Adding Verra or Gold Standard methodology rules to the manifest (upstream work in `article6-methodologies`)
- Formal validation/verification claims for non-UNFCCC registries — all output is scoped as readiness review
- Replacing or rewriting the UNFCCC-specific report composer — it stays as-is
- Multi-registry cross-referencing or comparison tooling
- Standard-specific branding (logos, boilerplate disclaimers per registry)

## Repo boundary

| Repo | Ownership |
|---|---|
| `article6-methodologies` | Canonical methodology metadata: provider, category, method code, version, display name, registry label, artifact paths, rule encoding |
| `app.article6` | Consumes the methodology pack/manifest; renders UI workflows, project reviews, and export/report output |

The app does not own, duplicate, or override canonical methodology metadata. If the pack does not contain Verra or Gold Standard entries, the app will not show them.

## Phase table

| Phase | Title | Status | Visible UI change |
|---|---|---|---|
| 0 | Contract and boundaries | In progress | None (doc only) |
| 1 | Pack/manifest consumption | Planned | None (internal) |
| 2 | Standard-grouped method picker | Planned | Picker grouped by standard |
| 3 | Project detail registry badge | Planned | Badge in project header |
| 4 | Generic standard-aware export composer | Planned | Structured report for all registries |
| 5 | Premium PDF wording and design | Planned | Polished PDF, no stub text |
| 6 | QuickCheck standard detection hardening | Planned | Context hints in analysis |
| 7 | Standard-specific composers (future) | Planned | None (doc only) |

## Phase details

### Phase 0 — Contract and boundaries

**Acceptance criteria:**
- All app-side expectations for provider, category, method code, version, display name, registry/standard label, and artifact paths are documented in this plan.
- Boundary between `article6-methodologies` (canonical metadata owner) and `app.article6` (consumer + workflow renderer) is clearly stated.
- No hand-stitched app-side manifest entries for Verra or Gold Standard exist yet.
- Existing UNFCCC consumption path is unchanged.

**Design contracts (app-side expectations):**

| Field | Source | Type | Example |
|---|---|---|---|
| `provider` | Manifest entry | `string` | `"UNFCCC"`, `"Verra"`, `"Gold Standard"` |
| `category` | Manifest entry | `string` | `"Forestry"`, `"Energy"`, `"Waste"` |
| `methodology` | Manifest entry | `string` | `"AR-ACM0003"`, `"VM0007"`, `"GS-VER1"` |
| `version` | Manifest entry | `string` | `"v02-0"`, `"v1.0"` |
| `registry/standard` | Derived from provider | `ProjectRegistry` | `'UNFCCC' \| 'Verra' \| 'Gold Standard' \| 'Unknown'` |
| Display label | Computed | `string` | `"{methodology} v{version} — {provider}/{category}"` |
| Artifact path | Manifest entry | `string` | `"methodologies/UNFCCC/Forestry/AR-ACM0003/v02-0/rules.json"` |

**Registry-to-provider mapping (app-side `normalizeRegistry`):**
- Provider starts with `"UNFCCC"` or equals `"CDM"` → `ProjectRegistry.UNFCCC`
- Provider starts with `"Verra"`, includes `"Verified Carbon Standard"`, or equals `"VCS"` → `ProjectRegistry.Verra`
- Provider starts with `"Gold Standard"` or equals `"GS"` → `ProjectRegistry.Gold Standard`
- Everything else → `ProjectRegistry.Unknown`

**Code-prefix fallback detection:**
- `VM`, `VMR` → Verra
- `GS` → Gold Standard
- `AR`, `AM`, `ACM`, `SSC`, `TOOL` → UNFCCC

---

### Phase 1 — Pack/manifest consumption

**Acceptance criteria:**
- App reads manifest from the methodology pack path, not a hardcoded app-side list.
- No methodology metadata is duplicated or stitched on the app side.
- Existing UNFCCC method loading and project creation still works identically.

**Implementation notes:**
- The existing `GET /api/projects/methods` route already reads from `public/manifest/index.json`. Verify this is consuming the canonical pack path — if the app is using a local copy or fallback, switch to the pack-sourced path.
- The `projectRegistryFromMethodProgram()` helper splits `"{provider}/{category}"` to infer the registry. This pattern is correct as long as the manifest comes from the pack.

---

### Phase 2 — Standard-grouped method picker

**Acceptance criteria:**
- Methodology picker groups options by standard/provider (UNFCCC, Verra, Gold Standard).
- Category (Forestry, Energy, etc.) is displayed within each standard group.
- Verra and Gold Standard options only appear when the manifest contains entries with those providers.
- Existing project creation flow for UNFCCC methods is unchanged.

**Visible UI change to look for:**
- Methodology selection dropdown shows grouped options: a clear visual separator between UNFCCC methods, Verra methods, and Gold Standard methods.
- Each option shows: methodology code, version, category, and rule count — within its standard group.

**Implementation approach:**
- In `NewProjectForm.tsx`, group the `methods` array by `program` prefix (the provider part) before rendering `<select>` options.
- Use `<optgroup>` or a custom grouped dropdown with visual section headers.
- The existing `projectRegistryFromMethodProgram()` already extracts the provider for registry inference — reuse that.

---

### Phase 3 — Project detail registry badge

**Acceptance criteria:**
- Project detail page shows a registry/standard badge next to the method code.
- Badge clearly displays: UNFCCC, Verra, or Gold Standard.
- Method code and version remain visible alongside the badge.
- Category label is displayed when available from manifest data.
- UNFCCC badge does not regress — existing projects show it correctly.

**Visible UI change to look for:**
- In `ProjectDetail.tsx`, next to the review mode badge and method code, a new pill/chip shows the standard name (e.g. a blue "Verra" pill, a green "Gold Standard" pill, or a slate "UNFCCC" pill).
- The badge color could differentiate standards subtly (e.g. UNFCCC → slate, Verra → blue, Gold Standard → amber).

**Implementation approach:**
- Add a new component or inline element in `ProjectDetail.tsx` near line 316.
- Use `resolveProjectRegistry(project)` from `verificationReport.ts` to get the registry.
- Store the category in the project if available (or derive from the manifest at method-picker time and pass it through).
- Badge is purely cosmetic — no changes to project data model required.

---

### Phase 4 — Generic standard-aware export composer

**Acceptance criteria:**
- Export produces a standard-aware report with truthful sections (no fictional registry-specific content).
- Report does not claim official Verra or Gold Standard validation/verification.
- Existing UNFCCC-specific composer (`composeUnfcccVerificationReport`) still dispatches correctly for UNFCCC projects.
- Generic composer is used for Verra and Gold Standard projects.
- Fallback/stub wording (`"registry_not_fully_supported"`, `"full renderer not yet implemented in v1"`) is removed from the export output for recognized registries.

**Report section structure (generic standard-aware):**

1. **REPORT STATUS** — Registry, report status, project status, methodology, completion summary
2. **PROJECT AND STANDARD** — Project name, registry/standard, methodology, AOI, dates
3. **METHODOLOGY BASIS** — Methodology code, version, category, rule count
4. **EVIDENCE REVIEWED** — Evidence references, reviewer notes
5. **REQUIREMENT REVIEW** — Per-rule findings with code, rationale, evidence links
6. **GAPS AND UNSUPPORTED CLAIMS** — Any gaps or unsupported items identified
7. **REVIEWER NOTES** — Reviewer-entered notes and observations
8. **PROVENANCE AND EXPORT METADATA** — Export timestamp, project ID, review coverage

Note: This is intentionally generic. Standard-specific sections (e.g. SDG contributions for Gold Standard, CCB for Verra) are deferred to Phase 7.

**Implementation approach:**
- Create a new `composeStandardAwareVerificationReport()` function in `verificationReport.ts`.
- It takes a `ProjectRegistry` parameter and produces the same `VerificationReportComposition` shape.
- Replace `composeVerraVerificationReport` and `composeGoldStandardVerificationReport` to call this new function (instead of `composeRecognizedFallbackReport`).
- Keep `composeRecognizedFallbackReport` for truly unknown registries.
- The `composeVerificationReport` dispatcher routes UNFCCC → existing composer, Verra/GS → new generic composer.

---

### Phase 5 — Premium PDF wording and design

**Acceptance criteria:**
- PDF export uses Article6-branded readiness review language for all known registries.
- No debug wording, internal provenance, or stub messages appear in the user-facing PDF.
- Registry-specific branding (logos, disclaimers) is not required — clean neutral design is sufficient.
- PDF design is consistent across UNFCCC, Verra, and Gold Standard exports.

**Visible UI change to look for:**
- Exported PDF for a Verra or Gold Standard project has clean wording: "Verification Readiness Report" or similar — no "fallback", "stub", "not yet implemented", or "v1 limitation" text.
- PDF reads like a professional deliverable regardless of registry.

**Wording rules:**
- `registry_not_fully_supported` → maps to "ready" for any known registry
- `"Truthful fallback: ..."` → remove; use standard readiness language
- `"full renderer not yet implemented in v1"` → remove; the generic composer is the renderer
- `"This export is not a full {registry} verification report"` → replace with standard limitation language matching UNFCCC's pattern

---

### Phase 6 — QuickCheck standard detection hardening

**Acceptance criteria:**
- QuickCheck detects Verra (VCS, Verified Carbon Standard, VM prefix, VMR prefix) in uploaded documents.
- QuickCheck detects Gold Standard (GS4GG, Gold Standard for the Global Goals, GS prefix).
- Detection is used for routing/context hints only, not as authoritative registry assignment.
- Existing UNFCCC detection is not regressed.
- Tests cover all new detection patterns.

**Detection patterns to add/review in `quickCheckEvidence.ts`:**

| Standard | Patterns |
|---|---|
| Verra / VCS | `Verra`, `VCS`, `Verified Carbon Standard`, `VM\d+`, `VMR\d+` |
| Gold Standard | `Gold Standard`, `GS4GG`, `Gold Standard for the Global Goals`, `GS-\w+` |
| UNFCCC / CDM (existing) | `UNFCCC`, `CDM`, `AR-`, `AM-`, `ACM-`, `SSC-`, `TOOL` |

---

### Phase 7 — Standard-specific composers (future)

**Acceptance criteria:**
- Future Verra-specific composer requirements are documented below.
- Future Gold Standard-specific composer requirements are documented below.
- No implementation work is done in this phase.
- Phase status remains "planned" until Verra/GS-specific metadata encoding is available upstream.

**Future Verra-specific composer notes:**
- Verra VCS reports include: Project Description, Baseline Scenario, Monitoring Plan, Leakage, Permanence, CCB (if applicable), SDG contributions
- VCS methodology rules will need section-level metadata to map findings to these headings
- The methodology pack must encode Verra-specific section IDs and section titles

**Future Gold Standard-specific composer notes:**
- Gold Standard reports include: Project Design, Additionally, Baseline, Monitoring, Safeguards Assessment, SDG Impact, Stakeholder Consultation
- GS methodology rules will need section-level metadata for these headings
- GS4GG rules have specific safeguards and SDG reporting requirements

## Risk areas

| Risk | Impact | Mitigation |
|---|---|---|
| Manifest consumption path is stale | Phase 1 may require refactoring how the app loads manifest data | Audit current `GET /api/projects/methods` path early in Phase 1 |
| Hand-stitched entries may already exist | App could be displaying Verra/GS entries from app-side data, not the pack | Audit the manifest and method loading paths — do not add fake entries; only show what the pack provides |
| UNFCCC regression in grouped picker | Category grouping inside UNFCCC may change, confusing existing users | Keep UNFCCC as the first group with the same display format; add groups below it |
| PDF output still contains debug text | Professional users see internal messages | Phase 5 explicitly removes stub wording; gate on known registry vs unknown |
| QuickCheck detection is treated as authoritative | Automatic registry assignment could be wrong | Detection is hints-only; final registry is set during project creation from the manifest provider |

## Testing strategy

| Phase | Testing approach |
|---|---|
| 0 | Review and signoff only |
| 1 | Manifest loading tests confirm correct provider/category extraction; regression tests for existing UNFCCC methods |
| 2 | Component tests for grouped dropdown rendering with UNFCCC, Verra, GS data; snapshot tests |
| 3 | Component tests for registry badge rendering; existing project detail tests pass unchanged |
| 4 | Unit tests for `composeStandardAwareVerificationReport` output shape; regression tests for `composeUnfcccVerificationReport` unchanged; tests confirm no stub wording in output |
| 5 | PDF snapshot/content tests confirm no stub/debug text; wording audit |
| 6 | Unit tests for all new detection patterns; existing QuickCheck tests pass unchanged |
| 7 | Review and signoff only |

## Delivery constraints

1. **Do not break existing UNFCCC workflow** — all changes are additive or behind the same standard-aware dispatch
2. **Do not add placeholder/fake Verra or Gold Standard methodology data** — only show standards when the pack provides them
3. **Do not claim official verification** — all output is readiness review; standard-specific validation language only after Phase 7
4. **Keep manifest canonical** — the app consumes, never owns, methodology metadata
5. **Each phase must merge independently** — no phase depends on code from a future phase
