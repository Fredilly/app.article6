import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  integrationDir,
  integrationManifestPath,
  packetPath,
  responsePath,
  responseSchemaPath,
  assertReviewedTruthFilesUnchanged,
  reviewedTruthFilePins,
  selectedRuleIds,
  validateIntegrationResponse,
} from "../../../scripts/preverif/generate-rc5-maya-methodology-expert-response-integration";

/* eslint-disable @typescript-eslint/no-explicit-any */

const readJson = (filePath: string): any => JSON.parse(fs.readFileSync(filePath, "utf8"));
const historicalIntegrationCommit = "c6b796a00a9786f40693c47738af784d24763398";

function regenerateHistoricalManifest() {
  const worktree = fs.mkdtempSync(path.join(process.cwd(), ".tmp-maya-methodology-integration-"));
  const outputDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-maya-methodology-output-"));
  try {
    execFileSync("git", ["worktree", "add", "--detach", worktree, historicalIntegrationCommit], { cwd: process.cwd(), stdio: "pipe" });
    const generatorPath = path.join(worktree, "scripts/preverif/generate-rc5-maya-methodology-expert-response-integration.ts");
    const tsx = path.join(process.cwd(), "node_modules/.bin/tsx");
    execFileSync(tsx, ["-e", `import { writeIntegrationManifest } from ${JSON.stringify(generatorPath)}; writeIntegrationManifest(${JSON.stringify(path.join(outputDir, "integration-manifest.json"))});`], { cwd: worktree });
    return { generated: fs.readFileSync(path.join(outputDir, "integration-manifest.json")), committed: fs.readFileSync(path.join(worktree, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/integration-manifest.json")) };
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: process.cwd(), stdio: "pipe" });
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

function copyReviewedTruthFiles() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-reviewed-truth-pins-"));
  const paths = reviewedTruthFilePins.map((pin, index) => {
    const copiedPath = path.join(tempDir, `${index}.json`);
    const bytes = execFileSync("git", ["show", `747bf16c7a2422157d776d565db82ec0fa3f1443:${pin.path}`], { cwd: process.cwd() });
    fs.writeFileSync(copiedPath, bytes);
    return copiedPath;
  });
  return { tempDir, paths };
}

describe("Maya independent expert response integration", () => {
  const response = readJson(responsePath);
  const packet = readJson(packetPath);
  const schema = readJson(responseSchemaPath);
  const manifest = readJson(integrationManifestPath);

  test("validates the Desktop response and contains exactly the three selected rules", () => {
    expect(() => validateIntegrationResponse(response, packet, schema)).not.toThrow();
    expect(Object.keys(response.responses).sort()).toEqual([...selectedRuleIds].sort());
    expect(response.responses[selectedRuleIds[0]].supportingProjectEvidence).toEqual([]);
    expect(manifest.selectedRuleIds).toEqual([...selectedRuleIds]);
  });

  test("preserves exact methodology and project evidence provenance", () => {
    for (const ruleId of selectedRuleIds) {
      const expert = response.responses[ruleId];
      const rule = packet.rules.find((candidate: any) => candidate.stableRuleId === ruleId);
      for (const evidence of expert.supportingMethodologyEvidence) {
        expect(rule.methodologyExcerpts).toEqual(expect.arrayContaining([expect.objectContaining({
          exactText: evidence.quote,
          sourcePath: evidence.sourcePath,
          sourceSha256: evidence.sourceSha256,
          pageStart: evidence.pageStart,
          pageEnd: evidence.pageEnd,
          sectionNumber: evidence.sectionNumber,
          sectionTitle: evidence.sectionTitle,
        })]));
      }
      for (const evidence of expert.supportingProjectEvidence) {
        expect(rule.originalPacketCandidateEvidence).toEqual(expect.arrayContaining([expect.objectContaining({
          quote: evidence.quote,
          page: evidence.page,
          sectionHeading: evidence.sectionHeading,
          spanId: evidence.spanId,
          provenance: { documentId: evidence.documentId, documentSha256: evidence.documentSha256, page: evidence.page, sectionHeading: evidence.sectionHeading, spanId: evidence.spanId, sourceType: "PDD" },
        })]));
      }
    }
  });

  test("rejects altered evidence fields and cross-rule evidence reuse", () => {
    const fields = [
      ["quote", "altered quote"],
      ["page", 999],
      ["sectionHeading", "altered section"],
      ["spanId", "altered span"],
      ["sourcePath", "altered path"],
      ["sourceSha256", "0".repeat(64)],
    ] as const;
    for (const [field, value] of fields) {
      const altered = structuredClone(response);
      if (field === "sourcePath" || field === "sourceSha256") altered.responses[selectedRuleIds[0]].supportingMethodologyEvidence[0][field] = value;
      else if (field === "sectionHeading" || field === "spanId" || field === "page") altered.responses[selectedRuleIds[1]].supportingProjectEvidence[0][field] = value;
      else altered.responses[selectedRuleIds[0]].supportingMethodologyEvidence[0][field] = value;
      expect(() => validateIntegrationResponse(altered, packet, schema)).toThrow();
    }
    const crossRule = structuredClone(response);
    crossRule.responses[selectedRuleIds[2]].supportingProjectEvidence = [structuredClone(response.responses[selectedRuleIds[1]].supportingProjectEvidence[0])];
    expect(() => validateIntegrationResponse(crossRule, packet, schema)).toThrow(/Project evidence/);
  });

  test("rejects missing or additional response rules and unsupported schema values", () => {
    const missing = structuredClone(response);
    delete missing.responses[selectedRuleIds[2]];
    expect(() => validateIntegrationResponse(missing, packet, schema)).toThrow();
    const additional = structuredClone(response);
    additional.responses.EXTRA = structuredClone(additional.responses[selectedRuleIds[0]]);
    expect(() => validateIntegrationResponse(additional, packet, schema)).toThrow();
    const unsupported = structuredClone(response);
    unsupported.responses[selectedRuleIds[0]].applicabilityDetermination = "MAYBE";
    expect(() => validateIntegrationResponse(unsupported, packet, schema)).toThrow();
  });

  test("keeps expert conclusions, provisional status, inventory, and pinned truth unchanged", () => {
    expect(manifest.rules[selectedRuleIds[0]]).toMatchObject({ applicabilityDetermination: "UNKNOWN", evidenceSufficiency: "INSUFFICIENT", reviewStatus: "PROVISIONAL" });
    expect(manifest.rules[selectedRuleIds[1]]).toMatchObject({ applicabilityDetermination: "NOT_APPLICABLE", evidenceSufficiency: "PARTIALLY_SUFFICIENT", reviewStatus: "PROVISIONAL" });
    expect(manifest.rules[selectedRuleIds[2]]).toMatchObject({ applicabilityDetermination: "APPLICABLE", evidenceSufficiency: "PARTIALLY_SUFFICIENT", reviewStatus: "PROVISIONAL" });
    expect(manifest.inventoryBefore).toEqual({ reviewedRuleCount: 39, provisionalRuleCount: 19 });
    expect(manifest.inventoryAfter).toEqual({ reviewedRuleCount: 39, provisionalRuleCount: 19 });
    expect(manifest.finalization).toEqual({ occurred: false, truthFilesCreated: false, machineTruthChanged: false, reviewedRowsChanged: false, reviewedTruthByteForByteUnchanged: true });
    expect(manifest.machineProposal.sha256).toBe("e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    expect(manifest.existingReviewedRowsSha256).toBe("922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1");
    expect(manifest.reviewedTruthFiles).toEqual(reviewedTruthFilePins.map((pin) => ({ path: pin.path, sha256: pin.sha256 })));
    expect(fs.existsSync(path.join(integrationDir, "reviewed-truth.json"))).toBe(false);
  });

  test("passes when all copied reviewed-truth files are unchanged", () => {
    const { tempDir, paths } = copyReviewedTruthFiles();
    try {
      expect(() => assertReviewedTruthFilesUnchanged(paths)).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails closed when file-level metadata changes outside decisions", () => {
    const { tempDir, paths } = copyReviewedTruthFiles();
    try {
      const changed = readJson(paths[0]);
      changed.sourceDocument.documentName = "metadata-mutated.pdf";
      fs.writeFileSync(paths[0], `${JSON.stringify(changed, null, 2)}\n`);
      expect(() => assertReviewedTruthFilesUnchanged(paths)).toThrow(/byte-for-byte/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails closed when a PROVISIONAL decision changes without changing REVIEWED rows", () => {
    const { tempDir, paths } = copyReviewedTruthFiles();
    try {
      const changed = readJson(paths[0]);
      const reviewedBefore = changed.decisions.filter((decision: any) => decision.reviewStatus === "REVIEWED");
      const provisional = changed.decisions.find((decision: any) => decision.reviewStatus === "PROVISIONAL");
      provisional.provisionalReason = `${provisional.provisionalReason} mutation`;
      expect(changed.decisions.filter((decision: any) => decision.reviewStatus === "REVIEWED")).toEqual(reviewedBefore);
      fs.writeFileSync(paths[0], `${JSON.stringify(changed, null, 2)}\n`);
      expect(() => assertReviewedTruthFilesUnchanged(paths)).toThrow(/byte-for-byte/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails closed when a REVIEWED decision changes", () => {
    const { tempDir, paths } = copyReviewedTruthFiles();
    try {
      const changed = readJson(paths[0]);
      const reviewed = changed.decisions.find((decision: any) => decision.reviewStatus === "REVIEWED");
      reviewed.reviewerConfidence = `${reviewed.reviewerConfidence}-mutation`;
      fs.writeFileSync(paths[0], `${JSON.stringify(changed, null, 2)}\n`);
      expect(() => assertReviewedTruthFilesUnchanged(paths)).toThrow(/byte-for-byte/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails closed when formatting changes without semantic changes", () => {
    const { tempDir, paths } = copyReviewedTruthFiles();
    try {
      fs.appendFileSync(paths[0], "\n");
      expect(() => assertReviewedTruthFilesUnchanged(paths)).toThrow(/byte-for-byte/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("keeps the historical integration manifest pinned", () => {
    const regenerated = regenerateHistoricalManifest();
    expect(regenerated.generated).toEqual(regenerated.committed);
    expect(regenerated.generated).toEqual(fs.readFileSync(integrationManifestPath));
    expect(fs.readdirSync(integrationDir).sort()).toContain("integration-manifest.json");
  });
});
