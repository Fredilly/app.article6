# Codebase Cleanup Plan (from Fallow reports in PR #694)

**Status**: Read-only planning document.  
**Source reports** (committed in PR #694):
- `artifacts/fallow/dead-code.json`
- `artifacts/fallow/dupes.json`
- `artifacts/fallow/health.json`

This PR only adds this plan. **No files are deleted, no dependencies removed or added, no components refactored, package.json / package-lock.json untouched, no routes / UI / API / runtime logic changed.**

All items below are proposals for **future, separate, tightly-scoped PRs**. Every future cleanup must re-verify against fresh reports (`npm run analyze:fallow:json`), follow the safety rules in [docs/codebase-cleanup.md](codebase-cleanup.md), and pass `npm run lint && npm run typecheck && npm test && npm run build`.

## Snapshot at time of PR #694

- **dead-code**: 157 total issues (21 unused files, 70 unused exports, 51 unused types, 2 unlisted dependencies, 9 duplicate exports, 0 circular/re-export cycles).
- **dupes**: 10.59% duplication across 39 clone groups (≥3 occurrences; 175 files involved, 9697 duplicated lines).
- **health**: 419 functions above thresholds (cyclomatic >25 or cognitive >20 after config relaxation), 147 critical severity. Average maintainability index 89.5/100. Top hotspot and complexity monster: `src/components/map/ProofMapTab.tsx`.

See the interpreting section of `docs/codebase-cleanup.md` for Fallow output meanings.

## 1. Safe to investigate first

Low blast-radius, high-confidence static findings, mostly internal/dev-only or pure surface-area reduction. Easy to verify with traces + targeted tests. Not part of primary user flows or hot paths.

### 1.1 Remove 4 unused exports in `src/lib/export/conventions.ts`

- **Source report**: `dead-code.json` (unused_exports) + `health.json` (refactoring target #4)
- **File/dependency affected**: `src/lib/export/conventions.ts` (specifically: `EXPORT_TIMESTAMP_FALLBACK`, `CANONICAL_EXPORT_TERMINOLOGY`, `exportSchemaVersion`, `exportSectionOrder`)
- **Risk level**: Low (module has fan-in=7 but 4/7 value exports are dead per report; 57% dead ratio)
- **Verification needed**:
  - `npx fallow dead-code --trace src/lib/export/conventions.ts:EXPORT_TIMESTAMP_FALLBACK` (repeat for each name)
  - `git grep -n "EXPORT_TIMESTAMP_FALLBACK\|CANONICAL_EXPORT_TERMINOLOGY\|exportSchemaVersion\|exportSectionOrder" -- src/ tests/ docs/`
  - Confirm no usage via dynamic `require`/`import()` or in generated artifacts
- **Suggested test command**: `npm run typecheck && npm test -- --testPathPattern="export|conventions" && npm run build && npm run verify:artifacts`

### 1.2 Address duplicate-export findings for shared type names (namespace-barrel style)

- **Source report**: `dead-code.json` (duplicate_exports section, 9 total)
- **File/dependency affected** (examples):
  - `EvidenceAttachment` (src/lib/proofMap/types.ts + src/lib/verify/reviewStore.ts)
  - `ReconciliationItemStatus` (src/lib/evidence/inventory.ts + src/lib/evidence/reconciliation/types.ts)
  - `RuleReview`, `buildEvidenceSnapshot`, `canonicalJsonStringify` (similar pairs across proof/auditTrail/export/proofMap)
- **Risk level**: Low (types + internal functions; report suggests either `ignoreExports` in `.fallowrc.json` or consolidate to one canonical location)
- **Verification needed**:
  - `npx fallow dead-code --explain duplicate-export`
  - Manual review of each pair to decide "intentional barrel" vs. "accidental dupe"
  - Check consumers in `src/lib/` and tests
- **Suggested test command**: `npm run typecheck && npm test -- --testPathPattern="evidence|proof|verify|export" && npm run build`

### 1.3 Declare (or explicitly ignore) the 2 unlisted dependencies

- **Source report**: `dead-code.json` (unlisted_dependencies)
- **File/dependency affected**:
  - `@napi-rs/canvas` (imported in `src/lib/chat/quickCheckPdfExtractor.ts:137`)
  - `tsconfig-paths` (imported in 4 scripts: `build-audit-pack.mjs`, `ci-verify-run-summary.mjs`, `test-evidence-map-smoke.cjs`, `verify-export-snapshot.mjs`)
- **Risk level**: Low (mostly scripts + one PDF extraction path; Fallow correctly flags them as used but undeclared)
- **Verification needed**:
  - Confirm they are present in `node_modules` and why they were not direct before (transitive?)
  - For canvas: test PDF-related paths (quick check pdf extract)
  - Decide: add to `dependencies`/`devDependencies` in package.json **or** add to `ignoreDependencies` in `.fallowrc.json`
- **Suggested test command**: `npm run build && node scripts/verify-export-snapshot.mjs && npm test -- --testPathPattern="quickCheckPdf|evidence-map" && npm run test:audit-pack:smoke`

### 1.4 Review / extract duplicated logic in build scripts (non-runtime)

- **Source report**: `dupes.json` (top clone groups, e.g. 90-line and 31-line groups)
- **File/dependency affected**: `scripts/build-derived-manifest.mjs`, `scripts/build-derived-artifacts.mjs`, `scripts/test-derived-determinism.mjs` (and similar)
- **Risk level**: Low (dev-only build/verify scripts; already partially ignored in dupes config for audit-pack mirrors)
- **Verification needed**: `npx fallow dupes --trace scripts/build-derived-manifest.mjs:44` (or equivalent); decide on shared util vs. acceptable duplication for standalone scripts
- **Suggested test command**: `npm run derive:all && npm run verify:derived && npm run determinism:audit-pack`

## 2. Requires manual verification

Medium risk. Findings are real per static analysis but have larger surface, possible intentional exceptions, recent code motion, or UI/test impact. Need deeper trace + runtime checks.

### 2.1 The 21 unused files (primarily legacy manifest + chat subcomponents + a few lib/ internals)

- **Source report**: `dead-code.json` (unused_files: 21)
- **File/dependency affected** (full list from snapshot):
  - `src/app/manifest/_state/useManifestFilters.ts`
  - `src/components/FinderShell.tsx`, `ManifestHealthBadge.tsx`, `MethodologiesPackProvenance.tsx`, `RuleCard.tsx`
  - `src/components/actions/ShareLinkButton.tsx`
  - `src/components/assistant/AssistantPanel.tsx`
  - `src/components/chat/Composer.tsx`, `MessageList.tsx`
  - `src/components/manifest/HashCopyButton.tsx`, `ManifestApp.tsx`, `MethodologyGroup.tsx`, `VersionDiffModal.tsx`
  - `src/components/snapshot/index.ts`
  - `src/components/verify/RunStatusCard.tsx`, `VerifierMinutesPanel.tsx`
  - `src/exports/buildAuditPack.ts`
  - `src/lib/evidence/extraction/index.ts`
  - `src/lib/manifest/data.ts`
  - `src/lib/snapshot/types.ts`
  - `src/lib/trace/evidenceLinks.ts`
- **Risk level**: Medium (zero inbound references per Fallow at snapshot time; many appear to be remnants of pre-`src/app/m/` manifest UI or older chat subcomponents. However, ChatApp is still mounted on `/` and some files may be reached via re-exports, dynamic routes, or test fixtures only. Recent quick-check work may have obsoleted others.)
- **Verification needed** (mandatory per category):
  - `npx fallow dead-code --trace-file <path>` for each
  - `git grep -r --include="*.ts" --include="*.tsx" --include="*.mjs" "FinderShell\|RuleCard\|useManifestFilters" .` (plus dynamic import checks)
  - Check `src/app/page.tsx`, `src/app/m/`, API routes, and all tests for indirect usage
  - Run full E2E smoke on manifest/quick-check/chat flows
  - Confirm not needed for backward compat in audit-pack exports or public data
- **Suggested test command**: `npm run typecheck && npm test && npm run build && npm run test:e2e -- --grep "manifest|quick-check|chat" || true`

Group into small future PRs (e.g. "dead-code: remove 5 orphaned manifest components" + separate for lib/ and chat subs).

### 2.2 High-priority "remove_dead_code" or "split" targets in lib/ that overlap with unused exports

- **Source report**: `health.json` (targets #3, #5, #6, #9 etc.)
- **File/dependency affected** (examples):
  - `src/lib/verify/reviewValidation.ts` (remove dead exports)
  - `src/lib/chat/quickCheck.ts` (split high-impact + some dead exports per dead-code)
  - `src/lib/verify/buildReviewSummary.ts` (split)
  - `src/lib/proofMap/evidenceSnapshot.ts` (extract)
- **Risk level**: Medium (lib code with dependents; dead exports may be safe but splits risk changing call sites and evidence pipelines)
- **Verification needed**: Full trace of callers, targeted unit tests for the modules, ensure audit-pack / verification report outputs unchanged (use `npm run verify:artifacts`)
- **Suggested test command**: `npm test -- --testPathPattern="verify|review|quickCheck|proof" && npm run build && npm run verify:artifacts`

### 2.3 Test and script duplication (non-production but still valuable to reduce)

- **Source report**: `dupes.json` (multiple groups in `tests/components/quickCheckPanel*.test.tsx`, `tests/components/finalReviewSummaryPanel.test.tsx`, ruleDetailModal etc.; also some cross test/lib)
- **Risk level**: Medium (tests can tolerate duplication more than prod code, but repeated logic increases maintenance; some appear to be copied test cases or fixtures)
- **Verification needed**: Ensure test coverage and assertions don't regress after any dedupe/extract to shared test utils
- **Suggested test command**: `npm test -- --testPathPattern="quickCheckPanel|finalReview|ruleDetail"`

## 3. Do not touch yet

High risk. Core to active user-facing features, very large/complex, high git churn, or in areas of active development. Refactors here would be large and risky even with good tests.

### 3.1 ProofMapTab and map-related complexity / hotspots

- **Source report**: `health.json` (top finding + top hotspot + multiple targets)
- **File/dependency affected**: `src/components/map/ProofMapTab.tsx` (4932 lines, cyclomatic 224 / cognitive 235, critical severity, hotspot score 56.4 with 95 commits, complexity_density 0.31)
- **Risk level**: Very high (interactive map using maplibre-gl; evidence pinning, AOI, layers, etc. Any extract/split risks subtle rendering, event, or state bugs visible to users. Also appears in other health targets.)
- **Verification needed**: Extensive Playwright map interaction tests + manual verification of all map features (search, pins, diffs, etc.). Do not attempt without a dedicated design for the split.
- **Suggested test command** (if ever): `npm run test:e2e -- --grep "map|proofmap" && npm test -- --testPathPattern="proofMap" && npm run build`

Leave as-is until a focused "map complexity reduction" initiative with before/after metrics.

### 3.2 Large, high-churn UI components in active primary workflows

- **Source report**: `health.json` (findings + hotspots + targets)
- **File/dependency affected**:
  - `src/components/chat/QuickCheckPanel.tsx` (2160+ lines, cyc 121 critical, hotspot, high priority extract target; heavily evolved in recent quick-check work)
  - `src/app/m/_components/MethodDetailPane.tsx` (1861 lines, cyc 151)
  - `src/app/m/_components/RuleDetailModal.tsx` (and related)
- **Risk level**: High (core of the review / quick-check / method UI that users interact with daily. Recent changes in the quick-check pipeline make any large refactor unstable.)
- **Verification needed**: Full E2E suite + visual/manual review of the review flow, quick check upload/evidence/review panels. Snapshot tests for any output.
- **Suggested test command**: `npm run test:e2e && npm test -- --testPathPattern="quickCheck|MethodDetail|RuleDetail" && npm run build`

### 3.3 Core evidence, proof, export, and audit-pack pipelines with high fan-in or isolation requirements

- **Source report**: health targets + dead-code (some overlap) + dupes (cross proof/proofMap)
- **File/dependency affected**: `src/lib/projects/exportPdf.ts`, `src/lib/proofMap/evidenceSnapshot.ts`, various in `src/lib/proof/`, `src/lib/evidence/`, `src/exports/`, audit-pack build scripts.
- **Risk level**: High (directly affect verification reports, PDF exports, audit packs, STAC, provenance — anything here can break client deliverables or CI artifacts)
- **Verification needed**: `npm run verify:artifacts`, `npm run determinism:audit-pack`, full build + golden checks, manual review of sample outputs.
- **Suggested test command**: `npm run ci` (or the full prebuild + verify + audit-pack steps)

### 3.4 Anything touching API routes, document parsing, or new quick-check semantic pipeline

Recent heavy investment in `src/app/api/quick-check/*`, `src/lib/quickCheck/`, `src/lib/documentParsing/`, etc. Even if some exports appear unused in the #694 snapshot, the area is evolving rapidly (many files added/changed post-snapshot).

**General rule for this category**: If a finding touches `src/app/api/`, `src/lib/document*`, `src/lib/quickCheck/`, or anything feeding the main review/quick-check loop — defer until the area stabilizes. Re-analyze after the next major quick-check milestone.

## Recommendations & Process

1. **Always start with fresh data**: Run `npm run analyze:fallow:json` and `git diff artifacts/fallow/` before proposing a cleanup PR. The #694 snapshot is historical.

2. **One category / small scope per PR** (see guidelines in `docs/codebase-cleanup.md`).

3. **Prefer non-deletion first** where possible (add tests for the "add_test_coverage" targets, `ignoreExports` / config modeling for intentional dups, `@expected-unused` tags).

4. **Update the plan + reports**: Any actual cleanup PR should update this document (mark items done) and refresh the JSON snapshots.

5. **Re-run the gates**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
   (Plus relevant `verify:*`, `ci:*` steps.)

This plan turns the visibility from PR #694 into an actionable, low-risk roadmap.

---

*Created after PR #694 (Fallow) was merged. Pure planning — no application behavior changes.*

**Signed-off-by:** Fred Egbuedike <fredilly@article6.org>