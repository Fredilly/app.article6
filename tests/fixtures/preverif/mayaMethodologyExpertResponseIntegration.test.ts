import crypto from "node:crypto";
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
  writeIntegrationManifest,
} from "../../../scripts/preverif/generate-rc5-maya-methodology-expert-response-integration";

/* eslint-disable @typescript-eslint/no-explicit-any */

const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const readJson = (filePath: string): any => JSON.parse(fs.readFileSync(filePath, "utf8"));

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

  test("fails closed when bytes outside REVIEWED decisions change", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-reviewed-truth-pins-"));
    try {
      const copiedPaths = reviewedTruthFilePins.map((pin, index) => {
        const copiedPath = path.join(tempDir, `${index}.json`);
        fs.copyFileSync(path.join(process.cwd(), pin.path), copiedPath);
        return copiedPath;
      });
      fs.appendFileSync(copiedPaths[0], "\n");
      expect(() => assertReviewedTruthFilesUnchanged(copiedPaths)).toThrow(/byte-for-byte/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("regenerates the integration manifest byte-for-byte", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-expert-response-integration-"));
    try {
      const generatedPath = path.join(tempDir, "integration-manifest.json");
      writeIntegrationManifest(generatedPath);
      expect(fs.readFileSync(generatedPath)).toEqual(fs.readFileSync(integrationManifestPath));
      expect(sha256(fs.readFileSync(generatedPath))).toBe(sha256(fs.readFileSync(integrationManifestPath)));
      expect(fs.readdirSync(tempDir)).toEqual(["integration-manifest.json"]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
