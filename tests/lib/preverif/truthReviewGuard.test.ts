import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const guard = path.join(repoRoot, "scripts/preverif/check-truth-review-guard.mjs");

type Scenario = { name: string; expectPass: boolean; mutate?: (dir: string) => void; message?: string; legacyBaseline?: boolean; noAudit?: boolean; twoRows?: boolean; oldCorrectedAudit?: boolean; migration?: boolean };

const rule = (id: string, quote = `Requirement ${id}`) => ({
  stable_id: id,
  source_span_text: quote,
  source_span_status: "source_audited",
  section_context: { page_start: 7, section_title: "Eligibility" },
});

function writeJson(dir: string, file: string, value: unknown): void {
  const target = path.join(dir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(dir: string, file: string): any { return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")); }
function git(dir: string, args: string[]): void { execFileSync("git", args, { cwd: dir, stdio: "ignore" }); }
function canonical(value: any): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function rowHash(value: any): string { return crypto.createHash("sha256").update(canonical(value)).digest("hex"); }

function makeRepo(legacyBaseline = false, noAudit = false, twoRows = false, oldCorrectedAudit = false): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truth-guard-"));
  fs.mkdirSync(path.join(dir, "public/methodologies/demo"), { recursive: true });
  fs.writeFileSync(path.join(dir, "public/methodologies/demo/rules.rich.json"), JSON.stringify([rule("Demo.v1.R-1", "The project meets the eligibility requirement."), rule("Demo.v1.R-2", "The project meets the eligibility requirement.")], null, 2));
  const fixture = path.join(dir, "tests/fixtures/preverif/demo"); fs.mkdirSync(fixture, { recursive: true });
  const evidence = { quote: "project evidence", page: 7, section: "Eligibility" };
  const row = { ruleId: "Demo.v1.R-1", stableRuleId: "Demo.v1.R-1", ruleReference: "Demo.v1.R-1", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS", acceptedEvidence: [evidence], methodologyTraceability: { methodology: "Demo", version: "v1", section: "Eligibility", methodologyPage: 7, officialRequirementQuote: "The project meets the eligibility requirement.", source_span_status: "source_audited" } };
  if (legacyBaseline) delete row.methodologyTraceability;
  writeJson(dir, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: ["Demo.v1.R-1"], rows: [row] });
  writeJson(dir, "tests/fixtures/preverif/demo/reviewedRuleIds.json", { reviewedRuleIds: ["Demo.v1.R-1"] });
  writeJson(dir, "tests/fixtures/preverif/demo/corrections.json", { reviewedRuleIds: ["Demo.v1.R-1"], acceptedEvidence: [{ ruleId: "Demo.v1.R-1", evidence }], finalTruth: [{ ruleId: "Demo.v1.R-1", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS" }] });
  writeJson(dir, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: ["Demo.v1.R-1"] } });
  if (!noAudit) writeJson(dir, "tests/fixtures/preverif/demo/independent-audit.json", { rows: [{ ruleReference: "Demo.v1.R-1", finalState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED", rationale: "Initial independent review is complete." }] });
  if (twoRows) { const second = { ...row, ruleId: "Demo.v1.R-2", stableRuleId: "Demo.v1.R-2", ruleReference: "Demo.v1.R-2" }; writeJson(dir, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: [row.ruleId, second.ruleId], rows: [row, second] }); writeJson(dir, "tests/fixtures/preverif/demo/reviewedRuleIds.json", { reviewedRuleIds: [row.ruleId, second.ruleId] }); writeJson(dir, "tests/fixtures/preverif/demo/corrections.json", { reviewedRuleIds: [row.ruleId, second.ruleId], acceptedEvidence: [{ ruleId: row.ruleId, evidence }, { ruleId: second.ruleId, evidence }], finalTruth: [{ ruleId: row.ruleId, finalEvidenceState: row.finalEvidenceState, reviewerOutcome: row.reviewerOutcome }, { ruleId: second.ruleId, finalEvidenceState: second.finalEvidenceState, reviewerOutcome: second.reviewerOutcome }] }); if (!noAudit) writeJson(dir, "tests/fixtures/preverif/demo/independent-audit.json", { rows: [{ ruleReference: row.ruleId, finalState: "FOUND", reviewerOutcome: "CONFORMS", rationale: "Initial independent review is complete." }, ...(oldCorrectedAudit ? [{ ruleReference: second.ruleId, finalState: "FOUND", reviewerOutcome: "CONFORMS", auditResult: "CORRECTED", rationale: "Historical correction." }] : [])] }); writeJson(dir, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: [row.ruleId, second.ruleId] } }); }
  fs.mkdirSync(path.join(dir, "tests/lib/preverif"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests/lib/preverif/demo.test.ts"), `import { expect } from "@jest/globals";\ntest("keeps demo truth", () => { expect(1).toBe(1); });\n// tests/fixtures/preverif/demo is the fixture under review\n`);
  fs.writeFileSync(path.join(dir, "tests/lib/preverif/shared.test.ts"), `test("shared preverif regression", () => { expect(true).toBe(true); });\n`);
  git(dir, ["init", "-q"]); git(dir, ["config", "user.email", "test@example.com"]); git(dir, ["config", "user.name", "Test"]); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "base"]); return dir;
}

function runScenario(scenario: Scenario): { status: number; output: string } {
    const dir = makeRepo(scenario.legacyBaseline, scenario.noAudit, scenario.twoRows, scenario.oldCorrectedAudit);
  try {
    scenario.mutate?.(dir); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "head"]);
    try { execFileSync("node", [guard, "--base-ref", "HEAD~1"], { cwd: dir, encoding: "utf8", env: { ...process.env, PREVERIF_TRUTH_GUARD_MIGRATION: scenario.migration ? "1" : "0" }, stdio: ["ignore", "pipe", "pipe"] }); return { status: 0, output: "" }; } catch (error: any) { return { status: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` }; }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function syncGold(dir: string, rows: any[]): void {
  const ids = rows.map((r) => r.ruleId);
  writeJson(dir, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: ids, rows });
  writeJson(dir, "tests/fixtures/preverif/demo/reviewedRuleIds.json", { reviewedRuleIds: ids });
  const corrections = readJson(dir, "tests/fixtures/preverif/demo/corrections.json");
  const oldIds = corrections.reviewedRuleIds ?? [];
  const finalTruth = [...(corrections.finalTruth ?? []), ...rows.filter((row) => !oldIds.includes(row.ruleId)).map((row) => ({ ruleId: row.ruleId, ...Object.fromEntries(["finalEvidenceState", "reviewerOutcome", "rationale", "clientAction", "draftFindingCandidate", "contradictionState"].filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]])) }))];
  writeJson(dir, "tests/fixtures/preverif/demo/corrections.json", { ...corrections, reviewedRuleIds: ids, finalTruth });
  writeJson(dir, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: ids } });
}

function addValidFixture(dir: string, name: string): void {
  const target = `tests/fixtures/preverif/${name}`; fs.mkdirSync(path.join(dir, target), { recursive: true });
  const row = { ruleId: "Demo.v1.R-1", stableRuleId: "Demo.v1.R-1", ruleReference: "Demo.v1.R-1", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS", methodologyTraceability: { methodology: "Demo", version: "v1", section: "Eligibility", methodologyPage: 7, officialRequirementQuote: "The project meets the eligibility requirement.", source_span_status: "source_audited" } };
  writeJson(dir, `${target}/gold.json`, { reviewedRuleIds: [row.ruleId], rows: [row] }); writeJson(dir, `${target}/reviewedRuleIds.json`, { reviewedRuleIds: [row.ruleId] }); writeJson(dir, `${target}/corrections.json`, { reviewedRuleIds: [row.ruleId], finalTruth: [{ ruleId: row.ruleId, finalEvidenceState: row.finalEvidenceState, reviewerOutcome: row.reviewerOutcome }] }); writeJson(dir, `${target}/metadata.json`, { review: { reviewedRuleIds: [row.ruleId] } });
  fs.writeFileSync(path.join(dir, "tests/lib/preverif", `${name}.test.ts`), `test("${name} fixture", () => { expect(true).toBe(true); });\n`);
}
function addFinalTruthCorrection(dir: string, row: any): void {
  const file = "tests/fixtures/preverif/demo/corrections.json"; const corrections = readJson(dir, file); const entry = { ruleId: row.ruleId, ...Object.fromEntries(["finalEvidenceState", "reviewerOutcome", "rationale", "clientAction", "draftFindingCandidate", "contradictionState"].filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]])) }; writeJson(dir, file, { ...corrections, finalTruth: [...(corrections.finalTruth ?? []), entry] });
}

function reconcileSecondEvidence(dir: string, fields = ["acceptedEvidence"], auditOverride: Record<string, unknown> = {}, appendAudit = true): void {
  const goldFile = "tests/fixtures/preverif/demo/gold.json"; const g = readJson(dir, goldFile); const before = g.rows[1]; const after = { ...before, acceptedEvidence: [{ quote: "new evidence", page: 7, section: "Eligibility" }] }; g.rows[1] = after; writeJson(dir, goldFile, g);
  const c = readJson(dir, "tests/fixtures/preverif/demo/corrections.json"); c.acceptedEvidence[1].evidence = after.acceptedEvidence[0]; writeJson(dir, "tests/fixtures/preverif/demo/corrections.json", c);
  const a = readJson(dir, "tests/fixtures/preverif/demo/independent-audit.json"); if (appendAudit) a.rows.push({ ruleReference: after.ruleId, finalState: after.finalEvidenceState, reviewerOutcome: after.reviewerOutcome, auditResult: "CORRECTED", rationale: "append", ...auditOverride }); writeJson(dir, "tests/fixtures/preverif/demo/independent-audit.json", a);
  writeJson(dir, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: g.reviewedRuleIds, reconciliation: [{ ruleId: after.ruleId, oldHash: rowHash(before), newHash: rowHash(after), changedFields: fields, reviewerRationale: "evidence reconciliation" }] } }); fs.writeFileSync(path.join(dir, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n");
}

function makeHistoricalRepo(withHistorical = false): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "historical-truth-"));
  const fixture = path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  fs.cpSync(path.join(repoRoot, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map"), fixture, { recursive: true });
  const baseGold = execFileSync("git", ["show", "origin/main:tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json"], { cwd: repoRoot });
  fs.writeFileSync(path.join(fixture, "gold.json"), baseGold);
  if (!withHistorical) fs.rmSync(path.join(fixture, "gold.rc2-rc3.json"), { force: true });
  fs.mkdirSync(path.join(dir, "public"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "public/methodologies"), path.join(dir, "public/methodologies"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tests/lib/preverif"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests/lib/preverif/marcondes.test.ts"), "test(\"marcondes fixture\", () => { expect(true).toBe(true); });\n// tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map\n");
  git(dir, ["init", "-q"]); git(dir, ["config", "user.email", "test@example.com"]); git(dir, ["config", "user.name", "Test"]); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "base"]); return dir;
}

function runHistoricalScenario(withHistorical: boolean, migration: boolean, mutate: (dir: string) => void): { status: number; output: string } {
  const dir = makeHistoricalRepo(withHistorical);
  try { mutate(dir); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "head"]); try { execFileSync("node", [guard, "--base-ref", "HEAD~1"], { cwd: dir, encoding: "utf8", env: { ...process.env, PREVERIF_TRUTH_GUARD_MIGRATION: migration ? "1" : "0" }, stdio: ["ignore", "pipe", "pipe"] }); return { status: 0, output: "" }; } catch (error: any) { return { status: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` }; } } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const validSecond = { ruleId: "Demo.v1.R-2", stableRuleId: "Demo.v1.R-2", ruleReference: "Demo.v1.R-2", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS", methodologyTraceability: { methodology: "Demo", version: "v1", section: "Eligibility", methodologyPage: 7, officialRequirementQuote: "The project meets the eligibility requirement.", source_span_status: "source_audited" } };
const scenarios: Scenario[] = [
  { name: "passes append-only valid gold rows", expectPass: true, mutate: (d) => syncGold(d, [...readJson(d, "tests/fixtures/preverif/demo/gold.json").rows, validSecond]) },
  { name: "blocks modifying a previous gold row during intake", expectPass: false, message: "previous gold row .* hash changed", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); g.rows[0].finalEvidenceState = "UNCLEAR"; syncGold(d, g.rows); } },
  { name: "blocks removed or reordered reviewed IDs", expectPass: false, message: "gold reviewedRuleIds must preserve", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); syncGold(d, [validSecond, ...g.rows]); } },
  { name: "blocks synthesized official quote", expectPass: false, message: "methodology quote mismatch", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); const row = { ...validSecond, methodologyTraceability: { ...validSecond.methodologyTraceability, officialRequirementQuote: "invented requirement" } }; syncGold(d, [...g.rows, row]); } },
  { name: "blocks incorrect methodology page", expectPass: false, message: "methodology page mismatch", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); const row = { ...validSecond, methodologyTraceability: { ...validSecond.methodologyTraceability, methodologyPage: 8 } }; syncGold(d, [...g.rows, row]); } },
  { name: "blocks incorrect methodology section", expectPass: false, message: "methodology section mismatch", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); const row = { ...validSecond, methodologyTraceability: { ...validSecond.methodologyTraceability, section: "Eligibility extra" } }; syncGold(d, [...g.rows, row]); } },
  { name: "blocks gold and independent audit together", expectPass: false, message: "gold and independent audit cannot change together", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows[0].finalEvidenceState = "UNCLEAR"; writeJson(d, "tests/fixtures/preverif/demo/gold.json", g); const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows[0].rationale = "changed"; writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); } },
  { name: "blocks production file with truth", expectPass: false, message: "outside affected fixture", mutate: (d) => { fs.mkdirSync(path.join(d, "src"), { recursive: true }); fs.writeFileSync(path.join(d, "src/change.ts"), "export const changed = true;\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks a fully valid second fixture", expectPass: false, message: "exactly one preverif fixture", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); addValidFixture(d, "other"); } },
  { name: "blocks deleted gold", expectPass: false, message: "required truth file missing or deleted: tests/fixtures/preverif/demo/gold.json", mutate: (d) => { fs.rmSync(path.join(d, "tests/fixtures/preverif/demo/gold.json")); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "intake\n"); } },
  { name: "blocks malformed gold", expectPass: false, message: "required truth file has wrong structure or is malformed: tests/fixtures/preverif/demo/gold.json", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/gold.json"), "not json\n"); } },
  { name: "blocks deleted audit", expectPass: false, message: "required truth file missing or deleted: tests/fixtures/preverif/demo/independent-audit.json", mutate: (d) => { fs.rmSync(path.join(d, "tests/fixtures/preverif/demo/independent-audit.json")); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "audit\n"); } },
  { name: "blocks malformed audit", expectPass: false, message: "required truth file has wrong structure or is malformed: tests/fixtures/preverif/demo/independent-audit.json", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/independent-audit.json"), "[]\n"); } },
  { name: "passes initial valid audit", expectPass: true, noAudit: true, mutate: (d) => { writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", { rows: [{ ruleReference: "Demo.v1.R-1", finalState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED", rationale: "Initial independent review is complete." }] }); } },
  { name: "blocks initial malformed audit row", expectPass: false, noAudit: true, message: "independent audit rationale is required", mutate: (d) => { writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", { rows: [{ ruleReference: "Demo.v1.R-1", finalState: "INVALID", reviewerOutcome: "CONFORMS" }] }); } },
  { name: "blocks audit of non-gold rule", expectPass: false, message: "already reviewed gold rule", mutate: (d) => { const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows.push({ ruleReference: "Demo.v1.R-2", finalState: "FOUND", reviewerOutcome: "CONFORMS", rationale: "review" }); writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); } },
  { name: "blocks short and full semantic duplicate audit IDs", expectPass: false, message: "canonical rule IDs must be unique", mutate: (d) => { const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows.push({ ruleReference: "R-1", finalState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED", rationale: "duplicate" }); writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); } },
  { name: "blocks new fixture with bad traceability", expectPass: false, message: "methodology quote mismatch", mutate: (d) => { addValidFixture(d, "new"); const g = readJson(d, "tests/fixtures/preverif/new/gold.json"); g.rows[0].methodologyTraceability.officialRequirementQuote = "invented"; writeJson(d, "tests/fixtures/preverif/new/gold.json", g); } },
  { name: "blocks new fixture containing gold and audit", expectPass: false, message: "new fixtures allow gold intake only", mutate: (d) => { addValidFixture(d, "new"); writeJson(d, "tests/fixtures/preverif/new/independent-audit.json", { rows: [] }); } },
  { name: "blocks deleted existing test", expectPass: false, message: "existing preverif test deleted: tests/lib/preverif/demo.test.ts", mutate: (d) => { fs.rmSync(path.join(d, "tests/lib/preverif/demo.test.ts")); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks changed expected literal", expectPass: false, message: "existing regression test file is immutable", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo.test.ts"), "test(\"keeps demo truth\", () => { expect(2).toBe(1); });\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "passes fixture-scoped existing test update", expectPass: true, mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo.test.ts"), "test(\"keeps demo truth\", () => { expect(2).toBe(2); });\n// tests/fixtures/preverif/demo is the fixture under review\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks renamed assertion identifier", expectPass: false, message: "existing regression test file is immutable", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo.test.ts"), "test(\"keeps demo truth\", () => { assert(1).toBe(1); });\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks describe.skip", expectPass: false, message: "existing regression test file is immutable", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo.test.ts"), "describe.skip(\"demo\", () => { test(\"keeps demo truth\", () => { expect(1).toBe(1); }); });\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks unreachable assertions after early return", expectPass: false, message: "existing regression test file is immutable", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo.test.ts"), "test(\"keeps demo truth\", () => { return; expect(1).toBe(1); });\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "passes new coverage in a new test file", expectPass: true, mutate: (d) => { fs.writeFileSync(path.join(d, "tests/lib/preverif/demo-new.test.ts"), "test(\"new coverage\", () => { expect(2).toBe(2); });\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks raw mutation during audit", expectPass: false, message: "raw machine artifact must remain unchanged", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/machine-proposal.json"), "{}\n"); const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows.push({ ruleReference: "Demo.v1.R-2", finalState: "FOUND", reviewerOutcome: "CONFORMS" }); writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); } },
  { name: "blocks raw mutation during reconciliation", expectPass: false, message: "raw machine artifact must remain unchanged", mutate: (d) => { fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/raw-evidence-map.json"), "{}\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows[0].finalEvidenceState = "UNCLEAR"; writeJson(d, "tests/fixtures/preverif/demo/gold.json", g); writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: ["Demo.v1.R-1"], reconciliation: [{ ruleId: "Demo.v1.R-1", oldHash: "x", newHash: "y", changedFields: ["finalEvidenceState"], reviewerRationale: "rationale" }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "blocks duplicate audit ID", expectPass: false, message: "canonical rule IDs must be unique", mutate: (d) => { const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows.push({ ...a.rows[0] }); writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); } },
  { name: "blocks unsupported evidence mutation during reconciliation", expectPass: false, message: "reconciliation hash record mismatch", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows[0].acceptedEvidence = [{ quote: "new" }]; writeJson(d, "tests/fixtures/preverif/demo/gold.json", g); const old = readJson(d, "tests/fixtures/preverif/demo/gold.json"); old.rows[0].acceptedEvidence = undefined; writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: ["Demo.v1.R-1"], reconciliation: [{ ruleId: "Demo.v1.R-1", oldHash: "bad", newHash: "bad", changedFields: ["acceptedEvidence"], reviewerRationale: "unsupported" }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "blocks unrelated accepted evidence through an audit append", expectPass: false, twoRows: true, message: "unsupported reconciliation field", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); const before = g.rows[1]; const after = { ...before, acceptedEvidence: [{ quote: "unrelated evidence", page: 7, section: "Eligibility" }] }; g.rows[1] = after; writeJson(d, "tests/fixtures/preverif/demo/gold.json", g); const c = readJson(d, "tests/fixtures/preverif/demo/corrections.json"); c.acceptedEvidence[1].evidence = after.acceptedEvidence[0]; writeJson(d, "tests/fixtures/preverif/demo/corrections.json", c); const a = readJson(d, "tests/fixtures/preverif/demo/independent-audit.json"); a.rows.push({ ruleReference: after.ruleId, finalState: after.finalEvidenceState, reviewerOutcome: after.reviewerOutcome, auditResult: "CONFIRMED", rationale: "append" }); writeJson(d, "tests/fixtures/preverif/demo/independent-audit.json", a); writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: g.reviewedRuleIds, reconciliation: [{ ruleId: after.ruleId, oldHash: rowHash(before), newHash: rowHash(after), changedFields: ["acceptedEvidence"], reviewerRationale: "unsupported" }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "blocks guard self-modification outside migration", expectPass: false, message: "outside affected fixture", mutate: (d) => { fs.mkdirSync(path.join(d, "scripts/preverif"), { recursive: true }); fs.writeFileSync(path.join(d, "scripts/preverif/check-truth-review-guard.mjs"), "changed\n"); const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); } },
  { name: "blocks an old corrected audit from authorizing evidence", expectPass: false, twoRows: true, oldCorrectedAudit: true, message: "unsupported reconciliation field", mutate: (d) => reconcileSecondEvidence(d, ["acceptedEvidence"], {}, false) },
  { name: "blocks missing acceptedEvidence metadata", expectPass: false, twoRows: true, message: "reconciliation changedFields mismatch", mutate: (d) => reconcileSecondEvidence(d, []) },
  { name: "blocks mismatched appended audit state", expectPass: false, twoRows: true, message: "audit finalState mismatch", mutate: (d) => reconcileSecondEvidence(d, ["acceptedEvidence"], { finalState: "UNCLEAR" }) },
  { name: "blocks previous corrections evidence mutation", expectPass: false, message: "corrections.acceptedEvidence must preserve", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); const c = readJson(d, "tests/fixtures/preverif/demo/corrections.json"); c.acceptedEvidence[0].evidence.quote = "changed"; writeJson(d, "tests/fixtures/preverif/demo/corrections.json", c); } },
  { name: "blocks contradictory old-rule correction entries", expectPass: false, message: "corrections.finalTruth must preserve", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); const c = readJson(d, "tests/fixtures/preverif/demo/corrections.json"); c.finalTruth[0].reviewerOutcome = "ACTION_REQUIRED"; writeJson(d, "tests/fixtures/preverif/demo/corrections.json", c); } },
  { name: "blocks unknown correction entry", expectPass: false, message: "unknown or untouched rule", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); const c = readJson(d, "tests/fixtures/preverif/demo/corrections.json"); c.finalTruth.push({ ruleId: "Demo.v1.UNKNOWN", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS" }); writeJson(d, "tests/fixtures/preverif/demo/corrections.json", c); } },
  { name: "blocks duplicate final-truth entries", expectPass: false, message: "finalTruth entries must not duplicate", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); const c = readJson(d, "tests/fixtures/preverif/demo/corrections.json"); c.finalTruth.push({ ...c.finalTruth.at(-1) }); writeJson(d, "tests/fixtures/preverif/demo/corrections.json", c); } },
  { name: "blocks unrelated existing preverif test modification", expectPass: false, message: "existing regression test file is immutable: tests/lib/preverif/shared.test.ts", mutate: (d) => { const g = readJson(d, "tests/fixtures/preverif/demo/gold.json"); g.rows.push(validSecond); syncGold(d, g.rows); fs.writeFileSync(path.join(d, "tests/lib/preverif/shared.test.ts"), "test(\"shared preverif regression\", () => { expect(false).toBe(true); });\n"); } },
  { name: "passes legacy row reconciliation without traceability rewrite", expectPass: true, legacyBaseline: true, mutate: (d) => { const before = readJson(d, "tests/fixtures/preverif/demo/gold.json").rows[0]; const after = { ...before, finalEvidenceState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED" }; writeJson(d, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: [after.ruleId], rows: [after] }); addFinalTruthCorrection(d, after); writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: [after.ruleId], reconciliation: [{ ruleId: after.ruleId, oldHash: rowHash(before), newHash: rowHash(after), changedFields: ["finalEvidenceState", "reviewerOutcome"], reviewerRationale: "Audit supports the state change." }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "passes coherent state action finding reconciliation", expectPass: true, mutate: (d) => { const before = readJson(d, "tests/fixtures/preverif/demo/gold.json").rows[0]; const after = { ...before, finalEvidenceState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED", rationale: "Rationale for the action", clientAction: "Request evidence", draftFindingCandidate: "NIR_CANDIDATE", contradictionState: "NONE_IDENTIFIED" }; writeJson(d, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: [after.ruleId], rows: [after] }); addFinalTruthCorrection(d, after); writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: [after.ruleId], reconciliation: [{ ruleId: after.ruleId, oldHash: rowHash(before), newHash: rowHash(after), changedFields: ["clientAction", "contradictionState", "draftFindingCandidate", "finalEvidenceState", "rationale", "reviewerOutcome"], reviewerRationale: "Audit supports the coherent action and finding." }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "passes reconciliation with explicit metadata", expectPass: true, mutate: (d) => { const before = readJson(d, "tests/fixtures/preverif/demo/gold.json").rows[0]; const after = { ...before, finalEvidenceState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED" }; writeJson(d, "tests/fixtures/preverif/demo/gold.json", { reviewedRuleIds: [after.ruleId], rows: [after] }); addFinalTruthCorrection(d, after); writeJson(d, "tests/fixtures/preverif/demo/metadata.json", { review: { reviewedRuleIds: [after.ruleId], reconciliation: [{ ruleId: after.ruleId, oldHash: rowHash(before), newHash: rowHash(after), changedFields: ["finalEvidenceState", "reviewerOutcome"], reviewerRationale: "Independent audit confirms the revised state." }] } }); fs.writeFileSync(path.join(d, "tests/fixtures/preverif/demo/REVIEW.md"), "reconciled\n"); } },
  { name: "passes when no truth artifacts change", expectPass: true, mutate: (d) => fs.writeFileSync(path.join(d, "README.md"), "no truth\n") },
  { name: "passes a new fixture with valid truth and a real test", expectPass: true, mutate: (d) => { const dir = path.join(d, "tests/fixtures/preverif/new"); fs.mkdirSync(dir, { recursive: true }); const r = { ...validSecond }; writeJson(d, "tests/fixtures/preverif/new/gold.json", { reviewedRuleIds: ["Demo.v1.R-2"], rows: [r] }); writeJson(d, "tests/fixtures/preverif/new/reviewedRuleIds.json", { reviewedRuleIds: ["Demo.v1.R-2"] }); writeJson(d, "tests/fixtures/preverif/new/corrections.json", { reviewedRuleIds: ["Demo.v1.R-2"], finalTruth: [{ ruleId: "Demo.v1.R-2", finalEvidenceState: r.finalEvidenceState, reviewerOutcome: r.reviewerOutcome }] }); writeJson(d, "tests/fixtures/preverif/new/metadata.json", { review: { reviewedRuleIds: ["Demo.v1.R-2"] } }); fs.writeFileSync(path.join(d, "tests/lib/preverif/new.test.ts"), "test(\"new fixture\", () => { expect(true).toBe(true); });\n"); } },
];

describe("generic preverif truth-review guard", () => {
  for (const scenario of scenarios) it(`${scenario.expectPass ? "pass" : "fail"}: ${scenario.name}`, () => {
    const result = runScenario(scenario);
    expect(result.status === 0).toBe(scenario.expectPass);
    if (!scenario.expectPass) expect(result.output).toMatch(new RegExp(scenario.message ?? "preverif-truth-guard"));
  });
});

describe("Marcondes historical truth migration guard", () => {
  test("passes the one-time exact historical truth migration", () => {
    const result = runHistoricalScenario(false, true, (dir) => fs.copyFileSync(path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json"), path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.rc2-rc3.json")));
    expect(result.status).toBe(0);
  });
  test.each([
    ["altered creation", false, true, (dir: string) => fs.writeFileSync(path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.rc2-rc3.json"), "altered\n"), "must exactly equal"],
    ["later mutation", true, false, (dir: string) => fs.appendFileSync(path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.rc2-rc3.json"), "altered\n"), "immutable"],
    ["later deletion", true, false, (dir: string) => fs.rmSync(path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.rc2-rc3.json")), "may not be deleted"],
    ["ordinary PR creation", false, false, (dir: string) => fs.copyFileSync(path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.json"), path.join(dir, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map/gold.rc2-rc3.json")), "requires the explicit migration condition"],
  ])("blocks %s", (_name, withHistorical, migration, mutate, message) => {
    const result = runHistoricalScenario(withHistorical as boolean, migration as boolean, mutate as (dir: string) => void);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(message);
  });
});
