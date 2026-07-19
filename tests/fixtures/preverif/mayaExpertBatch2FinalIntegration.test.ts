/* eslint-disable @typescript-eslint/no-explicit-any */
import Ajv from "ajv/dist/2020";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { baseCommit, machineRowSha256, packetDir, responsePath, responseSha256, resolvedRuleIds, ruleIds, subsequentTargetedIntegrationCommit, truthPath, truthRelativeFiles, validateIntegration, validateTruthProtection } from "../../../scripts/preverif/generate-rc5-maya-expert-batch2-final-integration";
import { buildExpectedIntegration as buildBatch3ExpectedIntegration, integratedTruthFiles as batch3IntegratedTruthFiles, responseSha256 as batch3ResponseSha256 } from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch3-integration";
import { buildExpectedIntegration as buildBatch4ExpectedIntegration, selectedRuleIds as batch4RuleIds } from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch4-integration";

const root = process.cwd();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const sha = (v: Buffer | string) => crypto.createHash("sha256").update(v).digest("hex");
const json = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const oldTruth = () => JSON.parse(execFileSync("git", ["show", `${baseCommit}:docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json`], { cwd: root, encoding: "utf8" }));
const targetedTruth = () => JSON.parse(execFileSync("git", ["show", `${subsequentTargetedIntegrationCommit}:docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json`], { cwd: root, encoding: "utf8" }));
const targetedRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0003", "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0005", "Verra.AFOLU.VM0007.v1-8.R-2-0006", "Verra.AFOLU.VM0007.v1-8.R-2-0007",
]);
const batch4RuleIdSet = new Set(batch4RuleIds);

describe("RC5-2 Maya batch 2 final integration", () => {
  test("corrected response is pinned, schema-valid, and bound to frozen rules", () => {
    const response = json(responsePath);
    expect(sha(fs.readFileSync(responsePath))).toBe(responseSha256);
    const schema = json(path.join(packetDir, "independent-review-response-schema.json"));
    expect(new Ajv({ strict: false }).compile(schema)(response)).toBe(true);
    expect(validateIntegration(response)).toBe(true);
    for (const ruleId of ruleIds.slice(0, 2)) expect(response.responses[ruleId].finalRuleDecision.stableRuleId).toBe(ruleId);
  });

  test("wrong rule hash and wrong provenance fail closed", () => {
    const response = json(responsePath);
    const wrongHash = clone(response);
    wrongHash.responses[ruleIds[0]].finalRuleDecision.machineRowSha256 = machineRowSha256[ruleIds[1]];
    expect(() => validateIntegration(wrongHash)).toThrow();
    const wrongEvidence = clone(response);
    wrongEvidence.responses[ruleIds[0]].finalRuleDecision.acceptedEvidence[0].page = 16;
    expect(() => validateIntegration(wrongEvidence)).toThrow();
  });

  test("preserves the two resolved rows through the later authorized integration", () => {
    const before = oldTruth();
    const after = json(truthPath);
    const later = targetedTruth();
    const batch3Expected = buildBatch3ExpectedIntegration().integrated.get(truthRelativeFiles[2])!;
    const batch4Expected = buildBatch4ExpectedIntegration().integrated;
    for (const row of before.decisions) {
      const current = after.decisions.find((r: any) => r.stableRuleId === row.stableRuleId);
      if (ruleIds.slice(0, 2).includes(row.stableRuleId)) expect(current.reviewStatus).toBe("REVIEWED");
      else if (batch4RuleIdSet.has(row.stableRuleId)) expect(current).toEqual(batch4Expected.get(truthRelativeFiles[2])!.decisions.find((r: any) => r.stableRuleId === row.stableRuleId));
      else if (targetedRuleIds.has(row.stableRuleId)) expect(current).toEqual(later.decisions.find((r: any) => r.stableRuleId === row.stableRuleId));
      else if (row.stableRuleId === ruleIds[2]) expect(current).toEqual(batch3Expected.decisions.find((r: any) => r.stableRuleId === row.stableRuleId));
      else expect(current).toEqual(row);
    }
    expect(after.decisions.find((r: any) => r.stableRuleId === ruleIds[2])).toEqual(batch3Expected.decisions.find((r: any) => r.stableRuleId === ruleIds[2]));
    const all = ["maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)].map((f, i) => i === 0 ? `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/${f}` : `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/${f}`);
    const rows = all.flatMap((f) => json(path.join(root, f)).decisions);
    expect(rows.filter((r: any) => r.reviewStatus === "REVIEWED")).toHaveLength(48);
    expect(rows.filter((r: any) => r.reviewStatus === "PROVISIONAL")).toHaveLength(10);
  });

  test("preserves prior rejected evidence and merges DeepSeek fields deterministically", () => {
    const before = oldTruth();
    const after = json(truthPath);
    const response = json(responsePath);
    const batch3Expected = buildBatch3ExpectedIntegration().integrated.get(truthRelativeFiles[2])!;
    for (const ruleId of resolvedRuleIds) {
      const oldRow = before.decisions.find((r: any) => r.stableRuleId === ruleId);
      const newRow = after.decisions.find((r: any) => r.stableRuleId === ruleId);
      expect(newRow.rejectedEvidence).toEqual(oldRow.rejectedEvidence);
      expect(JSON.stringify(newRow.rejectedEvidence)).toBe(JSON.stringify(oldRow.rejectedEvidence));
      expect(newRow.acceptedEvidence).toEqual(response.responses[ruleId].finalRuleDecision.acceptedEvidence);
      for (const field of ["reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "provisionalReason", "genericFailureCategory", "reviewerConfidence"]) expect(newRow[field]).toEqual(response.responses[ruleId].finalRuleDecision[field]);
      for (const field of Object.keys(oldRow)) if (!["reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "contradictionState", "draftFindingCandidate", "assessmentReason", "gap", "clientAction", "correctionReason", "provisionalReason", "genericFailureCategory", "reviewerConfidence"].includes(field)) expect(newRow[field]).toEqual(oldRow[field]);
    }
    expect(after.decisions.find((r: any) => r.stableRuleId === ruleIds[2])).toEqual(batch3Expected.decisions.find((r: any) => r.stableRuleId === ruleIds[2]));
  });

  test("truth protection rejects mutations outside the two allowed rows", () => {
    const bytes = Object.fromEntries(truthRelativeFiles.map((file) => [file, fs.readFileSync(path.join(root, file))]));
    const batch3 = JSON.parse(bytes[truthRelativeFiles[2]].toString("utf8"));
    const unrelatedReviewed = batch3.decisions.find((r: any) => r.reviewStatus === "REVIEWED" && !resolvedRuleIds.includes(r.stableRuleId));
    unrelatedReviewed.assessmentReason += " mutation";
    const changedReviewed = { ...bytes, [truthRelativeFiles[2]]: Buffer.from(`${JSON.stringify(batch3, null, 2)}\n`) };
    expect(() => validateTruthProtection(changedReviewed)).toThrow();
    const otherBatch = { ...bytes, [truthRelativeFiles[3]]: Buffer.from(bytes[truthRelativeFiles[3]].toString("utf8").replace("\n", "\n\n")) };
    expect(() => validateTruthProtection(otherBatch)).toThrow();
    const otherBatchJson = json(path.join(root, truthRelativeFiles[3]));
    const otherReviewed = otherBatchJson.decisions.find((r: any) => r.reviewStatus === "REVIEWED");
    otherReviewed.assessmentReason += " mutation";
    expect(() => validateTruthProtection({ ...bytes, [truthRelativeFiles[3]]: Buffer.from(`${JSON.stringify(otherBatchJson, null, 2)}\n`) })).toThrow();
    const deleted = { ...bytes, [truthRelativeFiles[3]]: Buffer.from(JSON.stringify({ ...json(path.join(root, truthRelativeFiles[3])), decisions: json(path.join(root, truthRelativeFiles[3])).decisions.slice(0, -1) }, null, 2) + "\n") };
    expect(() => validateTruthProtection(deleted)).toThrow();
    const addedJson = json(path.join(root, truthRelativeFiles[3]));
    addedJson.decisions.push({ ...addedJson.decisions[0], stableRuleId: "unrelated-added-row" });
    expect(() => validateTruthProtection({ ...bytes, [truthRelativeFiles[3]]: Buffer.from(`${JSON.stringify(addedJson, null, 2)}\n`) })).toThrow();
  });

  test("reproduces the current Batch 3 integration deterministically", () => {
    const first = buildBatch3ExpectedIntegration();
    const second = buildBatch3ExpectedIntegration();
    const currentExpected = buildBatch4ExpectedIntegration().integrated;
    expect([...first.integrated.entries()]).toEqual([...second.integrated.entries()]);
    for (const file of batch3IntegratedTruthFiles) expect(currentExpected.get(file)).toEqual(json(path.join(root, file)));
    const responseManifest = json(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-3/response-manifest.json"));
    const integrationManifest = json(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-3/integration-manifest.json"));
    expect(responseManifest.responseSha256).toBe(batch3ResponseSha256);
    expect(integrationManifest.inventory.after).toEqual({ reviewed: 45, provisional: 13, total: 58 });
    expect(integrationManifest.nonTargetRowsDeepCompared).toBe(true);
  });

  test("retains the prior authorized integration's deterministic truth protection", () => {
    const expected = Object.fromEntries(truthRelativeFiles.map((file) => [file, execFileSync("git", ["show", `${subsequentTargetedIntegrationCommit}:${file}`], { cwd: root })]));
    expect(validateTruthProtection(expected)).toMatchObject({ afterCounts: { reviewed: 39 + 4, provisional: 19 - 4 } });
    expect(fs.existsSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json"))).toBe(true);
  });
});
