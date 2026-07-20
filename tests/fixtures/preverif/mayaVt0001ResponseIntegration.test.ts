import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  baselineCommit,
  finalizedCorrectionReason,
  finalizedRuleId,
  integrationTruthFile,
  machinePath,
  machineProposalSha256,
  priorFinalizedRuleId,
  remainingProvisionalRuleIds,
  responsePath,
  responseSha256,
  selectedRuleIds,
  validateIntegration,
  validateResponse,
} from "../../../scripts/preverif/integrate-rc5-maya-vt0001-response";

const root = process.cwd();
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

describe("RC5-2 Maya VT0001 response integration", () => {
  test("pins the response, validates the final transition and inventory", () => {
    expect(cryptoSha(responsePath)).toBe(responseSha256);
    expect(validateIntegration()).toBe(true);
    const response = readJson(responsePath);
    expect(response.decisions).toHaveLength(3);
    expect(response.decisions.map((d: any) => d.stableRuleId).sort()).toEqual([...selectedRuleIds].sort());
    expect(response.decisions.filter((d: any) => d.reviewStatus === "REVIEWED").map((d: any) => d.stableRuleId)).toEqual([finalizedRuleId]);
    expect(response.decisions.filter((d: any) => d.reviewStatus === "PROVISIONAL").map((d: any) => d.stableRuleId).sort()).toEqual([...remainingProvisionalRuleIds].sort());
    const truthRows = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)].flatMap((file) => readJson(file).decisions);
    expect(truthRows).toHaveLength(58);
    expect(new Set(truthRows.map((row: any) => row.stableRuleId)).size).toBe(58);
    expect(truthRows.filter((row: any) => row.reviewStatus === "REVIEWED")).toHaveLength(52);
    expect(truthRows.filter((row: any) => row.reviewStatus === "PROVISIONAL")).toHaveLength(6);
    const finalized = truthRows.find((row: any) => row.stableRuleId === finalizedRuleId);
    expect(finalized).toMatchObject({ reviewStatus: "REVIEWED", finalEvidenceState: "FOUND", finalApplicability: "NOT_APPLICABLE", reviewerOutcome: "NOT_APPLICABLE" });
    expect(truthRows.find((row: any) => row.stableRuleId === priorFinalizedRuleId)).toMatchObject({ reviewStatus: "REVIEWED", finalEvidenceState: "N/A", finalApplicability: "NOT_APPLICABLE", reviewerOutcome: "NOT_APPLICABLE" });
    for (const id of remainingProvisionalRuleIds) expect(truthRows.find((row: any) => row.stableRuleId === id)).toMatchObject({ reviewStatus: "PROVISIONAL" });
    expect(cryptoSha(machinePath)).toBe(machineProposalSha256);
    expect(fs.existsSync(path.join(root, integrationTruthFile))).toBe(true);
    expect(baselineCommit).toBe("1ed30d230618de4ee86c316ccbaf8363a98a879a");
  });

  test("finalizes R-3-0003 with a VT0001-specific correction reason and preserves the prior R-3-0008 finalization", () => {
    const integrated = readJson(integrationTruthFile);
    const baseline = JSON.parse(execFileSync("git", ["show", `${baselineCommit}:${integrationTruthFile}`], { cwd: root }).toString("utf8"));
    const integratedRows = new Map(integrated.decisions.map((row: any) => [row.stableRuleId, row]));
    const baselineRows = new Map(baseline.decisions.map((row: any) => [row.stableRuleId, row]));
    const target = integratedRows.get(finalizedRuleId);
    expect(target.correctionReason).toBe(finalizedCorrectionReason);
    expect(target.correctionReason).not.toContain("Wave 1 PDD finality reassessment");
    for (const [id, row] of integratedRows) {
      if (id === finalizedRuleId || id === priorFinalizedRuleId) continue;
      expect(row.correctionReason).toBe(baselineRows.get(id).correctionReason);
    }
  });

  test.each([
    ["citation quote", (r: any) => { r.decisions[0].evidenceCitations[0].quote = r.decisions[0].evidenceCitations[0].quote.slice(0, -1); }],
    ["citation source path", (r: any) => { r.decisions[0].evidenceCitations[0].sourcePath = "tampered.json"; }],
    ["citation source SHA", (r: any) => { r.decisions[0].evidenceCitations[0].sourceSha256 = "0".repeat(64); }],
    ["duplicate decision", (r: any) => { r.decisions.push({ ...r.decisions[0] }); }],
    ["unexpected rule", (r: any) => { r.decisions[0].stableRuleId = "unexpected"; }],
    ["empty quote", (r: any) => { r.decisions[0].evidenceCitations[0].quote = ""; }],
  ])("rejects %s mutation", (_label, mutate) => {
    const response = readJson(responsePath);
    mutate(response);
    expect(() => validateResponse(response)).toThrow();
  });
});

function cryptoSha(file: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
}
