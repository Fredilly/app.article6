# Codebase Cleanup with Fallow

Fallow provides deterministic static codebase intelligence for this TypeScript/Next.js project (unused code, dependencies, duplication, complexity, circular dependencies, hotspots).

It is a **development-only** tool. No production impact.

## Installation & Scripts

- Added as `devDependency` (local binary via npm).
- Configured via [.fallowrc.json](../.fallowrc.json) (entry points for scripts, ignore patterns for build artifacts, relaxed severities to `warn` during rollout, tuned dupes/health thresholds).
- `.fallow/` (cache, snapshots) is gitignored.

### npm scripts

```bash
npm run analyze:fallow        # Human-readable compact + summary for dead-code, dupes, health (top issues)
npm run analyze:fallow:json   # (Re)generates machine-readable reports to artifacts/fallow/*.json
```

The `:json` variant always refreshes the committed snapshots under `artifacts/fallow/`.

Run via `npx fallow ...` directly for ad-hoc (supports `--format json|compact|markdown`, `--production`, `--trace`, `--top N`, `--explain`, etc.).

Note: You may see transient "WARN invalid entry pattern" lines on stderr (originating from complex `node -e "..."` values inside package.json `"scripts"`). These are discovery noise only and do not affect the analysis results or JSON reports.

## Generated Reports

Reports are (re)generated locally and committed as snapshots so Codex / future work has deterministic input:

- [artifacts/fallow/dead-code.json](artifacts/fallow/dead-code.json) — unused files/exports/types, unused/unlisted deps, duplicate exports, etc. (circulars: 0)
- [artifacts/fallow/dupes.json](artifacts/fallow/dupes.json) — clone groups (currently ~10.6% duplication, min 3 occurrences, audit-pack mirrors excluded)
- [artifacts/fallow/health.json](artifacts/fallow/health.json) — complexity findings, file scores, hotspots (churn + complexity), refactoring targets

Re-run `npm run analyze:fallow:json` after any source changes or before proposing cleanup to update baseline.

(Compact human output also available on demand; full JSON includes `actions` for auto-fix hints and agent use.)

## Interpreting Findings

- **Unused code / files / exports**: Candidates for deletion or modeling as intentional (entry points, public API, dynamically loaded). Scripts/ are now declared entries so their files are not spuriously "unused". Review `unused_exports` and `unused_files` from dead-code report. Use `fallow dead-code --trace src/foo.ts:bar` or `--trace-file` to understand reachability.
- **Unused / unlisted dependencies**: `unlisted_dependencies` in dead-code (e.g. `@napi-rs/canvas`, `tsconfig-paths` at time of snapshot) indicate imports without `package.json` entry — add them or remove usage.
- **Duplicate code**: Focus on higher `line_count` + `occurrences >= 3`. Many small clones are noise; current actionable ones live in build/roadmap scripts. Duplication % from stats.
- **Complexity hotspots & targets**: Functions exceeding ~25 cyclomatic / ~20 cognitive. Hotspots combine with git churn (ProofMapTab.tsx is the largest by far — interactive map component; also QuickCheck panels, some lib extractors). Targets ranked by priority/effort suggest extracts + tests.
- **Circular dependencies / re-export cycles**: Currently clean (0).
- Cross-reference via `fallow health --file-scores`, `--hotspots`, `--targets`, or `--score`.

See upstream:
- https://docs.fallow.tools/analysis/dead-code
- https://docs.fallow.tools/analysis/duplication
- https://docs.fallow.tools/explanations/health
- https://docs.fallow.tools/cli/dead-code (and health/dupes)

## Future Cleanup PR Guidelines

This first PR **only establishes visibility and tooling**. No files, exports, routes, components, or dependencies were deleted.

Subsequent PRs must follow:

1. **Category at a time, scoped tightly**:
   - One PR: "dead-code: remove 3 proven-unused components in src/components/ (FinderShell, RuleCard, ...)" 
   - Separate: "health: extract helpers from QuickCheckPanel and buildReviewSummary"
   - Separate: "dupes: dedupe 14-line manifest diff logic between scripts/ and src/lib/"
   - Do not mix deletions + refactors + dep bumps in one PR.

2. **Evidence required**:
   - Cite the exact report (e.g. "dead-code.json unused-file:src/components/Foo.tsx + verify no other references").
   - Reproduce locally: `npm run analyze:fallow:json`, `git diff artifacts/fallow/`.
   - For agents/Codex: feed the relevant JSON slice + `fallow explain ...`.

3. **Safety & verification (mandatory)**:
   - Confirm with `fallow dead-code --trace-file <path>` + manual `rg` / `git grep`.
   - For exports: check runtime (dynamic import, next routes, test coverage, public API surface).
   - Never delete without existing tests or add smoke coverage.
   - Run: `npm run typecheck && npm run lint && npm test && npm run build`.
   - `npm run ci` subset if full slow.
   - If a finding is intentional (e.g. future API, test-only kept for coverage), model it narrowly: `@expected-unused`, `ignoreExports` in config, or `entry`/`dynamicallyLoaded`, not broad ignores.

4. **Report updates**:
   - Cleanup PRs should re-run `npm run analyze:fallow:json` and include updated snapshots so the "debt ledger" shrinks visibly.
   - Prefer narrowing exceptions in `.fallowrc.json` over accumulating inline suppressions.

5. **Order of operations (recommended)**:
   - Unresolved/unlisted deps first (high confidence).
   - Truly unused files (after entry modeling).
   - Unused exports/types (model public surface with tags/config).
   - Duplication consolidation.
   - Hotspot refactors (extracts, not deletes).

6. **No whack-a-mole**:
   - Every change must be justified by Fallow output + verification that it does not regress the existing `ci` gate or app behavior.
   - Large components (e.g. ProofMapTab) are refactor targets, not delete candidates.

## Rolling out stricter policy

- Current rules are `warn` for visibility without blocking.
- Once a category is cleaned and stable for a while, promote matching rule(s) to `"error"` in `.fallowrc.json`.
- Consider adding regression baselines (see Fallow `--save-regression-baseline`) or `fallow audit` for PR gates in follow-ups.

Questions? Run `npx fallow explain unused-export` (or any code) or consult the docs linked above.

---

*Added as part of establishing evidence-based cleanup foundation. No application behavior changes.*
