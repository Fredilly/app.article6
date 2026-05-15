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
| 0 | Contract and boundaries | Done | None (doc only) |
| 1 | Pack/manifest consumption | Done | None (internal) |
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

**Current app contract audit:**

The following is a line-by-line audit of every app code path that touches methodology metadata, provider, program, category, and registry. This is the frozen contract that Phase 1 and later phases must preserve for UNFCCC.

---

**1. GET /api/projects/methods** (`src/app/api/projects/methods/route.ts`)

Reads `public/manifest/index.json` from disk. Iterates all manifest entries and deduplicates by `{methodology}@{version}`. For each unique method, derives a `program` string:

```typescript
const program = `${entry.provider || ''}/${entry.category || ''}`.replace(/^\//, '') || 'Unknown';
```

Returns JSON:
```json
{
  "methods": [
    {
      "code": "AR-ACM0003",
      "program": "UNFCCC/Forestry",
      "version": "v02-0",
      "ruleCount": 42
    }
  ]
}
```

Current manifest entries have `provider` set to `"UNFCCC"` only. No entries with `"Verra"` or `"Gold Standard"` exist.

This is a Next.js route handler (`runtime: 'nodejs'`). No caching, no fallback — reads the file on every request.

Contract invariant: `program` always encodes `{provider}/{category}`. Category may be empty; the `.replace(/^\//, '')` normalizes a leading slash away. If both provider and category are absent, program is `"Unknown"`.

---

**2. GET /api/projects/method-rules** (`src/app/api/projects/method-rules/route.ts`)

Takes `code` and `version` query params. Reads `public/manifest/index.json` and filters manifest entries where `e.methodology === code && e.version === version`. Maps matching manifest rows directly to `{ id, title, sectionId }`.

```typescript
const rules = entries
  .filter((e) => e.methodology === code && e.version === version)
  .map((e) => ({
    id: e.rule_id || e.id,
    title: e.rule || e.title || '',
    sectionId: e.sectionId || '',
  }));
```

The route does **not** dereference `entry.path` or load a separate `rules.json` artifact. All rule metadata is inlined in the manifest row.

Contract invariants:
- Rule loading is manifest-filter-based, not artifact-path-based
- `code` matches `manifest.methodology`, `version` matches `manifest.version`
- Returned rules are flat manifest rows — no registry awareness, no artifact loading
- Any future migration to artifact-backed rule loading must be done intentionally with UNFCCC regression tests

---

**3. Methodology picker** (`src/components/projects/NewProjectForm.tsx`)

Fetches `GET /api/projects/methods` on mount. Renders a flat `<select>` dropdown:

```
{code} v{version} — {program} ({ruleCount} rules)
```

Example option: `AR-ACM0003 v02-0 — UNFCCC/Forestry (42 rules)`

On form submit, when `reviewMode === 'methodology-linked'`:
1. Looks up the selected method record from the fetched methods array
2. Calls `projectRegistryFromMethodProgram(selectedMethodRecord?.program)` to infer the registry
3. Passes the inferred registry to `createProject()`

Contract invariants:
- The picker displays `program` literally from the API (provider/category format)
- Registry is inferred at project creation time and stored on the `Project` object
- The picker is flat — no grouping by provider/standard today
- The registry label flows into `Project.registry` via `createProject`

---

**4. `projectRegistryFromMethodProgram()`** (`src/lib/projects/verificationReport.ts:520-521`)

```typescript
export function projectRegistryFromMethodProgram(program: string | undefined): ProjectRegistry {
  return normalizeRegistry(program?.split('/')[0]);
}
```

Takes the `program` string (e.g. `"UNFCCC/Forestry"`), splits on `/`, passes the first segment (`"UNFCCC"`) to `normalizeRegistry`.

Contract invariant: The first segment of `program` is always the provider name. The app assumes `{provider}/{category}` format.

---

**5. `normalizeRegistry()`** (`src/lib/projects/verificationReport.ts:54-61`)

```typescript
function normalizeRegistry(value: string | undefined): ProjectRegistry {
  const raw = value?.trim().toLowerCase() ?? '';
  if (!raw) return 'Unknown';
  if (raw.startsWith('unfccc') || raw === 'cdm') return 'UNFCCC';
  if (raw.startsWith('verra') || raw.includes('verified carbon standard') || raw === 'vcs') return 'Verra';
  if (raw.startsWith('gold standard') || raw === 'gold-standard' || raw === 'gs') return 'Gold Standard';
  return 'Unknown';
}
```

Returns a `ProjectRegistry` union type: `'UNFCCC' | 'Verra' | 'Gold Standard' | 'Unknown'`.

Contract invariants:
- Case-insensitive (lowercases input)
- `"UNFCCC"` matches by prefix (`"unfccc"`). Also matches exact `"cdm"`.
- `"Verra"` matches by prefix (`"verra"`), substring (`"verified carbon standard"`), or exact (`"vcs"`)
- `"Gold Standard"` matches by prefix (`"gold standard"`), exact (`"gold-standard"`), or exact (`"gs"`)
- Anything unknown returns `"Unknown"` — will not silently map to a wrong registry

---

**6. `resolveProjectRegistry()`** (`src/lib/projects/verificationReport.ts:63-74`)

```typescript
export function resolveProjectRegistry(project: Pick<Project, 'methodCode' | 'registry'>): ProjectRegistry {
  const explicit = normalizeRegistry(project.registry);
  if (explicit !== 'Unknown') return explicit;

  const code = project.methodCode?.trim().toUpperCase() ?? '';
  if (!code) return 'Unknown';
  if (code.startsWith('UNFCCC.') || code.includes('UNFCCC')) return 'UNFCCC';
  if (code.startsWith('VM') || code.startsWith('VMR') || code.includes('VERRA')) return 'Verra';
  if (code.startsWith('GS') || code.includes('GOLD STANDARD')) return 'Gold Standard';
  if (/^(AR|AM|ACM|SSC|TOOL)/.test(code)) return 'UNFCCC';
  return 'Unknown';
}
```

Two-tier resolution:
1. **Tier 1** (preferred): Checks the explicit `project.registry` field (set at project creation time from the manifest program). If it resolves to a known registry, use it.
2. **Tier 2** (fallback): If the explicit registry is unknown/missing, falls back to method code prefix matching.

Contract invariants:
- Tier 1 takes priority — this allows overriding the registry even if the method code suggests a different one
- Tier 2 detection is heuristic only, for projects created before registry inference was added
- Code checks are case-insensitive (UPPERCASED input)
- `VM` prefix = Verra (covers VM0007, VM0042, etc.)
- `VMR` prefix = Verra (covers VMR001, etc.)
- `GS` prefix = Gold Standard (covers GS VER1, GS VER2, etc.)
- `AR/AM/ACM/SSC/TOOL` prefix = UNFCCC (covers all CDM large/small scale methods)
- Used during export via `composeVerificationReport` (line 494)

---

**7. `createProject()`** (`src/lib/projects/storage.ts:43-81`)

Accepts an optional `registry?: Project['registry']` field. Stores it directly on the `Project` object.

The type `Project.registry` is `ProjectRegistry | undefined` (optional field).

For manual review projects, `registry` is not set (undefined). For methodology-linked projects, it is inferred from the manifest program.

Contract invariant: Registry is stored at project creation time and may be absent for older projects or manual review projects. The fallback `resolveProjectRegistry` handles the absent case.

---

**8. `composeVerificationReport()`** (`src/lib/projects/verificationReport.ts:488-518`)

```typescript
export function composeVerificationReport(project, coverage, exportTime?) {
  if (project.reviewMode === 'manual') return composeManualVerificationReport(...);
  const registry = resolveProjectRegistry(project);
  if (registry === 'UNFCCC') return composeUnfcccVerificationReport(...);
  if (registry === 'Verra') return composeVerraVerificationReport(...);       // stub fallback
  if (registry === 'Gold Standard') return composeGoldStandardVerificationReport(...); // stub fallback
  // Unknown registry → generic fallback with status 'registry_not_fully_supported'
}
```

Dispatch rules:
- Manual review mode → `composeManualVerificationReport()` (registry-agnostic)
- UNFCCC → `composeUnfcccVerificationReport()` (full implementation)
- Verra → `composeVerraVerificationReport()` (currently calls `composeRecognizedFallbackReport` — stub)
- Gold Standard → `composeGoldStandardVerificationReport()` (currently calls `composeRecognizedFallbackReport` — stub)
- Unknown → inline generic fallback with `status: 'registry_not_fully_supported'`

Contract invariants:
- The UNFCCC path is fully implemented and must never regress
- Verra and Gold Standard currently produce stub output (`registry_not_fully_supported` status with fallback wording)
- Phase 4 will replace the Verra/GS stubs with the generic standard-aware composer
- Phase 7 will add registry-specific composers on top

---

**9. `composeUnfcccVerificationReport()`** (`src/lib/projects/verificationReport.ts:214-328`)

Full implementation that produces:
- Report title: "UNFCCC VERIFICATION REPORT"
- Sections: REPORT STATUS, PROJECT AND METHODOLOGY IDENTIFICATION, VERIFICATION SCOPE, MEANS OF VERIFICATION, FINDINGS SUMMARY, REQUIREMENT FINDINGS, EVIDENCE APPENDIX, LIMITATIONS, PROVENANCE
- Uses `UNFCCC_SECTION_ORDER` for consistent ordering
- Uses `buildFindings(project)` and `buildEvidenceSummary(project)` for content
- Handles both `ready` and `insufficient_source_content` states

Must not be touched by any phase. If a future phase needs to modify the UNFCCC output, it should go through the generic composer (Phase 4) or a separate UNFCCC-specific update cycle.

---

**10. Export PDF API** (`src/app/api/projects/[id]/export-pdf/route.ts`)

Calls `buildProjectExportPdf(project, coverage)` which internally calls `composeVerificationReport()`. The PDF filename is `verification-pack-{methodCode}-{projectId}.pdf` for methodology-linked projects.

Contract invariant: PDF generation is a synchronous pipeline: project → coverage → composeVerificationReport → PDF bytes. No registry-specific branching in the route handler.

---

**11. QuickCheck evidence regex** (`src/lib/chat/quickCheckEvidence.ts`)

Currently detects patterns in uploaded document text:
- `Gold Standard|Verified Carbon Standard|Climate Action Reserve|American Carbon Registry`

Used for routing/context hints only, not authoritative registry assignment. Phase 6 will harden the detection.

---

**12. `inferManualRegistryLabel()`** (`src/lib/projects/verificationReport.ts:118-137`)

Scans `project.registry`, document file names, and extracted text for registry signals. Used only for manual review projects (as a display label). Not used for registry inference during project creation or export dispatch.

Contract invariant: This is a cosmetic label helper for the manual review PDF cover page. It is not involved in the export dispatch decision.

---

**Summary of UNFCCC-protected invariants:**

| Invariant | Where enforced | Must remain |
|---|---|---|
| Manifest loads from `public/manifest/index.json` | `route.ts` | Read path unchanged |
| Program format = `{provider}/{category}` | `methods/route.ts:18` | Split on `/`, first segment = provider |
| Registry inferred from program first segment | `projectRegistryFromMethodProgram` | Callers unchanged |
| UNFCCC export uses dedicated composer | `composeVerificationReport` dispatch | Dispatch to UNFCCC composer unchanged |
| UNFCCC composer produces full sections | `composeUnfcccVerificationReport` | All section titles and content unchanged |
| `Project.registry` is optional | `types.ts:136` | Type definition unchanged |
| Fallback `resolveProjectRegistry` method-code heuristic | `verificationReport.ts:63-74` | Code prefix order and matching unchanged |
| Flat method picker display format | `NewProjectForm.tsx:158-162` | UNFCCC options maintain current label format within their group |
| Method-rules loads from manifest filter, not artifact path | `method-rules/route.ts:22-28` | Filters `e.methodology === code && e.version === version`; future artifact migration requires regression tests |
| Manual review is registry-agnostic | `composeManualVerificationReport` | No registry inference for manual projects |

---

### Phase 1 — Pack/manifest consumption

**Acceptance criteria:**
- App reads manifest from the methodology pack path, not a hardcoded app-side list.
- No methodology metadata is duplicated or stitched on the app side.
- Existing UNFCCC method loading and project creation still works identically.

**Phase 1 implementation audit:**

The following is a complete audit of where `public/manifest/index.json` comes from and how the app consumes it.

---

**Where the manifest comes from:**

`public/manifest/index.json` is a **committed static file**. It is NOT auto-generated from the methodology pack during build. The file must be manually updated when the pack adds or removes entries.

The full build pipeline is:

```
prebuild
  └─ fetch:methodologies-pack   (downloads pack tarball → public/methodologies/ + public/_provenance/)
  └─ derive:all
       ├─ build:derived          (reads manifest → builds derived/summary.json, derived/rule_index.json per entry path)
       ├─ manifest:derived       (reads manifest → builds derived/manifest.json per entry path)
       └─ verify:derived         (reads manifest → verifies derived artifacts match pinned hashes)
```

The manifest drives every downstream step:
- `build:derived` and `manifest:derived` iterate the manifest's `path` entries to find methodology directories
- `verify:derived` checks that the files listed in each derived manifest match actual disk contents
- The manifest is the **single source of truth** for which methodologies are indexed

**Key files in the consumption path:**

| File | Role |
|---|---|
| `config/methodologies_pack.json` | Pinned tag for upstream methodology release (repo + tag + asset) |
| `scripts/fetch-methodologies-pack.sh` | Downloads and extracts pack tarball to `public/methodologies/` |
| `public/manifest/index.json` | Committed index of all methodology rule entries |
| `src/app/api/projects/methods/route.ts` | Reads manifest, deduplicates by `{methodology}@{version}`, returns `{ code, program, version, ruleCount }` |
| `src/app/api/projects/method-rules/route.ts` | Reads manifest, filters by `e.methodology === code && e.version === version`, returns `{ id, title, sectionId }` |
| `src/lib/manifest/cards.ts` | `loadManifestEntries()` reads manifest for engine enrichment |
| `scripts/guard-methodology-boundary.mjs` | Prevents editing vendored methodology files (`public/methodologies/`) in normal app PRs |
| `scripts/build-derived-artifacts.mjs` | Reads manifest to find methodology paths, builds derived artifacts |
| `scripts/build-derived-manifest.mjs` | Reads manifest to find methodology paths, builds derived manifest per directory |
| `scripts/verify-derived-artifacts.mjs` | Reads manifest to find methodology paths, verifies derived artifact integrity |

**The gap:**

The manifest is committed independently of the methodology pack. When the upstream pack adds new entries (e.g. Verra or Gold Standard methodologies), the manifest must be updated manually or through a separate sync process. There is currently no CI automation that rebuilds the manifest from the pack contents.

**Current manifest state (Phase 1 audit):**

| Metric | Value |
|---|---|
| Total manifest entries | 42 |
| Unique methodologies | 4 |
| Unique programs (provider/category) | 1 — `UNFCCC/Forestry` |
| Providers present | `UNFCCC` only |
| Verra entries | 0 |
| Gold Standard entries | 0 |

**Verdict: Phase 1 is complete for the current app state.**

The app correctly consumes the canonical committed manifest. No hand-stitched package-level metadata exists in the app itself. The guard scripts (`guard-methodology-boundary.mjs`) protect the app/methodologies boundary. The manifest correctly indexes only what the methodology pack provides.

**Future work (not blocking Phase 1 completion):**
- Auto-generate the manifest from the pack contents during `derive:all` so new pack entries appear automatically
- This is tracked as a follow-up item outside the 8-phase roadmap

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
- Gold Standard reports include: Project Design, Additionality, Baseline, Monitoring, Safeguards Assessment, SDG Impact, Stakeholder Consultation
- GS methodology rules will need section-level metadata for these headings
- GS4GG rules have specific safeguards and SDG reporting requirements

## Risk areas

| Risk | Impact | Mitigation |
|---|---|---|
| Manifest consumption path is stale | Phase 1 was completed — the app correctly consumes the committed manifest | No further action needed; manifest is the SSOT for methodology indexing |
| Hand-stitched entries may already exist | App could be displaying Verra/GS entries from app-side data, not the pack | Audit the manifest and method loading paths — do not add fake entries; only show what the pack provides |
| UNFCCC regression in grouped picker | Category grouping inside UNFCCC may change, confusing existing users | Keep UNFCCC as the first group with the same display format; add groups below it |
| PDF output still contains debug text | Professional users see internal messages | Phase 5 explicitly removes stub wording; gate on known registry vs unknown |
| QuickCheck detection is treated as authoritative | Automatic registry assignment could be wrong | Detection is hints-only; final registry is set during project creation from the manifest provider |

## Testing strategy

| Phase | Testing approach |
|---|---|
| 0 | Review and signoff only |
| 1 | Manifest consumption tests added at `tests/lib/projects/manifestConsumption.test.ts` (24 tests): manifest shape, program format, registry inference, normalizeRegistry edge cases, resolveProjectRegistry fallback |
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
