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
| 2 | Standard-grouped method picker | Done | Picker grouped by standard |
| 3 | Project detail registry badge | Done | Badge in project header |
| 4 | Generic standard-aware export composer | Done | Structured report for all registries |
| 5 | Premium PDF wording and design | Done | Polished PDF, no stub text |
| 6 | QuickCheck standard detection hardening | Done | Context hints in analysis |
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
- Committed app manifest consumption path is audited and hardened.
- No methodology metadata is duplicated or stitched on the app side.
- Every route consuming the manifest is documented with contract invariants.
- Regression tests prove manifest shape, program format, and registry inference behave correctly.
- Existing UNFCCC method loading and project creation still works identically.
- Manifest-to-pack auto-sync is tracked as a follow-up item, not claimed as done.

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

**Verdict: Phase 1 audit and hardening is complete for the current committed-manifest app state.**

The app correctly consumes the committed manifest. No hand-stitched package-level metadata exists in the app itself. The guard scripts (`guard-methodology-boundary.mjs`) protect the app/methodologies boundary. The manifest correctly indexes only what the methodology pack provides.

Note: The manifest is still a committed static file, not auto-synced from the pack. The consumption path is audited and hardened, but pack-to-manifest auto-sync is separate future work.

**Future work (not part of this 8-phase roadmap):**
- Auto-generate the manifest from the pack contents during `derive:all` so new pack entries appear automatically

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

**Implementation notes:**
- Added `RegistryBadge` component in `ProjectDetail.tsx` using `resolveProjectRegistry(project)`.
- Added `methodCategory` field to `Project` type, stored at project creation time from the `program` string's category segment.
- Category displayed as a separate pill next to the registry badge.
- Badge and category are purely cosmetic — no export or project creation logic changes.

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

**Implementation notes:**
- Created `composeGenericStandardAwareReport()` in `verificationReport.ts` — produces 7 sections (REPORT STATUS, PROJECT AND STANDARD, METHODOLOGY BASIS, EVIDENCE REVIEWED, REQUIREMENT REVIEW, REVIEWER NOTES, PROVENANCE AND EXPORT METADATA).
- `composeVerraVerificationReport` and `composeGoldStandardVerificationReport` now call the generic composer instead of `composeRecognizedFallbackReport`.
- `composeVerificationReport` dispatcher routes UNFCCC → existing composer, Verra/GS/Unknown → generic composer.
- `composeRecognizedFallbackReport` was removed — no more stub/fallback wording in user-facing output.
- All registry outputs use "READINESS REPORT" title with standard-aware readiness review language.

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

**Implementation notes:**
- Cover page uses dynamic `report.title` (e.g. "VERRA READINESS REPORT", "UNFCCC VERIFICATION REPORT") with "Readiness Review" subtitle and registry label.
- Inner page section header shows "READINESS REVIEW" for non-UNFCCC, "VERIFICATION REPORT" for UNFCCC.
- Footer label varies by registry: "Verification Report" for UNFCCC, "Readiness Review" for others.
- No debug, internal, or stub wording appears in any registry's PDF output.

---

### Phase 6 — QuickCheck standard detection hardening

**Acceptance criteria:**
- QuickCheck detects Verra (VCS, Verified Carbon Standard, VM prefix, VMR prefix) in uploaded documents.
- QuickCheck detects Gold Standard (GS4GG, Gold Standard for the Global Goals, GS prefix).
- Detection is used for routing/context hints only, not as authoritative registry assignment.
- Existing UNFCCC detection is not regressed.
- Tests cover all new detection patterns.

**Implementation notes:**
- Added standalone detection for Verra, VCS, Verified Carbon Standard (full name)
- Added VM-prefixed (VM0007, VM 0007) and VMR-prefixed (VMR001, VMR 001) methodology code detection
- Added GS4GG, Gold Standard for the Global Goals, and GS-prefixed methodology code detection
- All detections feed into `methodologyMentions` used for QuickCheck confidence scoring
- Detection is non-authoritative — no registry assignment logic depends on it
- 13 tests added covering all new patterns; existing UNFCCC/CDM detection unchanged

---

### Phase 7 — Standard-specific composers (future)

**Phase 7 is blocked on upstream metadata.** Standard-specific composers must not be implemented in `app.article6` until `article6-methodologies` encodes canonical metadata for each standard. The app must not invent report structure, section taxonomy, or disclaimer language that belongs to the methodology pack.

**Acceptance criteria:**
- Future Verra-specific composer requirements are documented below.
- Future Gold Standard-specific composer requirements are documented below.
- No implementation work is done in this phase.
- Phase status remains "planned" until Verra/GS-specific metadata encoding is available upstream.

**Minimum upstream metadata needed from `article6-methodologies` before Phase 7 can start:**

| Requirement | Description |
|---|---|
| Standard-specific section taxonomy | Each standard's report has a distinct section structure (e.g. Verra: Project Description, Baseline, Monitoring, Leakage, Permanence, CCB, SDG; GS: Project Design, Additionality, Baseline, Monitoring, Safeguards, SDG Impact, Stakeholder Consultation) |
| Required export sections per standard | Sections that must appear in a standard-specific report (e.g. for Verra VCS: baseline scenario, monitoring plan, leakage calculation; for GS: safeguards assessment, stakeholder consultation) |
| Mapped methodology section references | Each rule in the methodology pack must carry a `section_id` or `section_ref` that maps to the standard's report section taxonomy, so the composer can group findings under the correct heading |
| Expected evidence categories per standard | Evidence types each standard expects for specific rules/sections (e.g. Verra CCB requires biodiversity and community evidence; GS requires SDG contribution evidence) |
| Safe disclaimer language per standard | Registry-approved disclaimer text for readiness reports that do not claim official validation or verification — must not be invented by the app |

**Until upstream metadata is available:**
- The generic standard-aware composer from Phase 4 covers all known registries with truthful, neutral sections.
- Adding standard-specific sections before metadata is ready risks producing misleading or non-compliant outputs.
- This phase must remain `planned`, not `active` or `in_progress`.

## Risk areas

| Risk | Impact | Mitigation |
|---|---|---|
| Manifest consumption path is stale | Phase 1 was completed — the app correctly consumes the committed manifest | No further action needed; manifest is the SSOT for methodology indexing |
| Hand-stitched entries may already exist | App could be displaying Verra/GS entries from app-side data, not the pack | Audit the manifest and method loading paths — do not add fake entries; only show what the pack provides |
| UNFCCC regression in grouped picker | Category grouping inside UNFCCC may change, confusing existing users | UNFCCC remains the first group with the same display format; groups added below it (Phase 2 complete) |
| PDF output still contains debug text | Professional users see internal messages | Phase 5 completed — cover page, header, and footer are registry-aware with premium wording |
| QuickCheck detection is treated as authoritative | Automatic registry assignment could be wrong | Detection is hints-only; final registry is set during project creation from the manifest provider |

## Testing strategy

| Phase | Testing approach |
|---|---|
| 0 | Review and signoff only |
| 1 | Manifest consumption tests added at `tests/lib/projects/manifestConsumption.test.ts` (24 tests): manifest shape, program format, registry inference, normalizeRegistry edge cases, resolveProjectRegistry fallback |
| 2 | 7 unit tests for `groupMethodsByRegistry`: grouping, ordering, sorting, empty, Unknown |
| 3 | 4 component tests for RegistryBadge rendering (UNFCCC, Verra, Gold Standard, Unknown); existing tests pass unchanged |
| 4 | Unit + PDF export tests: Verra/GS/Unknown route to generic composer, output includes registry/method/version/category, no stub/fallback wording, UNFCCC unchanged |
| 5 | PDF content tests for Verra/Gold Standard readiness report titles, forbidden wording across UNFCCC/Verra/GS, footer label correctness |
| 6 | 13 unit tests for Verra/VCS/VM/VMR, Gold Standard/GS4GG/GS prefix, UNFCCC regression; all existing QuickCheck tests pass |
| 7 | Review and signoff only |

## Delivery constraints

1. **Do not break existing UNFCCC workflow** — all changes are additive or behind the same standard-aware dispatch
2. **Do not add placeholder/fake Verra or Gold Standard methodology data** — only show standards when the pack provides them
3. **Do not claim official verification** — all output is readiness review; standard-specific validation language only after Phase 7
4. **Keep manifest canonical** — the app consumes, never owns, methodology metadata
5. **Each phase must merge independently** — no phase depends on code from a future phase

## Phase 7 Readiness Audit (2026-05-15)

The following audit confirms the app is correctly staged for Phase 7 implementation. All checks pass.

### phase-status.json

| Check | Result |
|---|---|
| `RC7` value is `"planned"` | PASS |
| Phase 7 title is `"Standard-specific composers (future)"` | PASS |
| No phase is marked `"active"` or `"in_progress"` for Phase 7 | PASS |

### PLAN.md — Phase 7 documentation

| Check | Result |
|---|---|
| Acceptance criteria for Verra/GS composers documented | PASS (lines 524-528) |
| Minimum upstream metadata requirements table present | PASS (lines 530-538) |
| Explicit note that Phase 7 is blocked until methodology metadata exists | PASS (lines 522-523, 540-543) |
| No implementation work specified in Phase 7 | PASS |

### Phase 4 — Generic standard-aware composer

| Check | Result | Evidence |
|---|---|---|
| `composeVerraVerificationReport` delegates to `composeGenericStandardAwareReport('Verra', ...)` | PASS | `verificationReport.ts:428-429` |
| `composeGoldStandardVerificationReport` delegates to `composeGenericStandardAwareReport('Gold Standard', ...)` | PASS | `verificationReport.ts:432-433` |
| Produces truthful, neutral sections (REPORT STATUS, PROJECT AND STANDARD, METHODOLOGY BASIS, EVIDENCE REVIEWED, REQUIREMENT REVIEW, REVIEWER NOTES, PROVENANCE AND EXPORT METADATA) | PASS | `verificationReport.ts:330-338` |
| No claims of official Verra/GS validation or verification | PASS | `verificationReport.ts:351` |
| UNFCCC path unchanged | PASS | `verificationReport.ts:558` |
| No stub/fallback wording in output | PASS | Tests confirm forbidden phrases absent |
| PDF export produces correct sections and wording per registry | PASS | 17 PDF export tests pass |

### QuickCheck detection integration

| Check | Result | Evidence |
|---|---|---|
| Verra, VCS, Verified Carbon Standard detected as methodology mentions | PASS | `quickCheckEvidence.ts:598-610` |
| VM/VMR prefix codes detected | PASS | `quickCheckEvidence.ts:613-626` |
| Gold Standard, GS4GG, GS prefix detected | PASS | `quickCheckEvidence.ts:629-636` |
| Detection feeds `methodologyMentions` only — no effect on registry assignment | PASS | Registry assignment via `normalizeRegistry`/`resolveProjectRegistry` is an independent path |
| 13 detection tests pass, UNFCCC regression tests pass | PASS | `tests/lib/quickCheckEvidence.test.ts` |
| Standard-only mentions (`Verra`, `VCS`, `Gold Standard`) suppress the "No methodology mentions detected" warning when present | PASS | `quickCheckEvidence.ts:942-943` — warning only fires when `!methodologyMentions.size` |

### Infrastructure readiness for Phase 7

| Component | Status | Details |
|---|---|---|
| Section mapping | READY | `GENERIC_SECTION_ORDER` in `verificationReport.ts:330-338` covers all generic sections. Phase 7 will add standard-specific composers alongside. |
| Evidence linking | READY | `buildEvidenceSummary` feeds into EVIDENCE REVIEWED section. Common to all composers. |
| PDF export | READY | Registry-agnostic pipeline: project → coverage → `composeVerificationReport` → PDF bytes (`exportPdf.ts:196-198`). Road handler has no registry branching. |
| Footer/header dispatch | READY | `exportPdf.ts:226-230` selects footer label by registry; section label by registry (UNFCCC vs non-UNFCCC). |
| Dispatcher extension point | READY | `composeVerificationReport` at `verificationReport.ts:551-563` routes by registry. Phase 7 swaps the generic delegate for a registry-specific composer. |
| Verra composer stub | READY | `composeVerraVerificationReport` at `verificationReport.ts:428-429` currently delegates to generic. This is the Phase 7 insertion point. |
| GS composer stub | READY | `composeGoldStandardVerificationReport` at `verificationReport.ts:432-433` currently delegates to generic. This is the Phase 7 insertion point. |
| No hand-stitched metadata | CONFIRMED | No app-side Verra/GS manifest entries. No invented report structure. |
| No fictional disclaimer language | CONFIRMED | Safe disclaimer language is explicitly listed as upstream dependency — not implemented in app. |

### Test suite results

All 85 tests pass across the relevant suites:

| Suite | Tests | Result |
|---|---|---|
| `tests/lib/projects/verificationReport.test.ts` | 16 | PASS |
| `tests/lib/projects/manifestConsumption.test.ts` | 28 | PASS |
| `tests/lib/quickCheckEvidence.test.ts` | 24 | PASS |
| `tests/lib/quickCheckUi.test.ts` | 8 | PASS |
| `tests/api/project.export-pdf.route.test.ts` | 17 | PASS |

### Conclusion

The app is correctly staged for Phase 7. No implementation work has been started. The generic standard-aware composer from Phase 4 covers all known registries with truthful, neutral sections. Phase 7 must remain `planned` until `article6-methodologies` provides canonical metadata (section taxonomy, export sections, mapped section references, evidence categories, safe disclaimer language).
