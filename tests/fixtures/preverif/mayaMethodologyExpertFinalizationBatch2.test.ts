import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv/dist/2020";
import { packetDir, selectedRuleIds, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-methodology-expert-finalization-batch2";

/* eslint-disable @typescript-eslint/no-explicit-any */

const root = process.cwd();
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const packetPath = path.join(packetDir, "review-packet.json");
const templatePath = path.join(packetDir, "review-template.json");
const schemaPath = path.join(packetDir, "review-response-schema.json");
const manifestPath = path.join(packetDir, "manifest.json");

describe("Maya methodology-expert finalization batch 2", () => {
  const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  test("selects exactly the three merged-scope methodology-expert rules", () => {
    expect(packet.rules.map((rule: any) => rule.stableRuleId)).toEqual([...selectedRuleIds]);
    expect(manifest.selectedRuleIds).toEqual([...selectedRuleIds]);
    expect(manifest.selectedRuleScopeGroups).toEqual(Object.fromEntries(selectedRuleIds.map((id) => [id, "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION"])))
    expect(manifest.mergedProvisionalScope.groupCounts).toEqual({ CAN_FINALIZE_FROM_EXISTING_PACKET: 0, REQUIRES_TARGETED_FULL_PDD_RETRIEVAL: 16, REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION: 3, BLOCKED_BY_PROVENANCE_OR_SCHEMA: 0 });
    expect(packet.rules).not.toEqual(expect.arrayContaining([expect.objectContaining({ scopeGroup: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL" })]));
  });

  test("pins every historical and methodology input and keeps selected rules provisional", () => {
    expect(manifest.mergedProvisionalScope.sha256).toBe("f3fd97e932eb6a023c302313f5f4df5cad286751994b469f502226f1bc00e21a");
    expect(manifest.historicalInputs.originalPacket.sha256).toBe("403a810a02fcf5c259c73c30e7db7b2380577d1d02eb650aea62f0298435a99f");
    expect(manifest.historicalInputs.originalTruth.sha256).toBe("d02dc6dcbd608a6080ea6601849d3d2c58d0743fe09fa7a5c13db404662731a5");
    expect(manifest.historicalInputs.machineProposal.sha256).toBe("e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    expect(manifest.historicalInputs.methodologyRules.sha256).toBe("9fceaa1dc458c847c1236fad73215f56b924ebbec794850b60c0510ace7d0e49");
    expect(manifest.historicalInputs.methodologySections.sha256).toBe("4506bb488417a940fc4e84228bff7abcc7e7921fcb9a824fa140bf6e2687b5e3");
    expect(manifest.historicalInputs.methodologyMeta.sha256).toBe("0b426189afb549bcb0af65efac74c69ceabdb9ee6026efd3d6494788d9a19839");
    expect(manifest.historicalInputs.pdd.sha256).toBe("407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b");
    expect(manifest.mergedProvisionalScope.inventory).toMatchObject({ reviewedRuleCount: 39, provisionalRuleCount: 19 });
  });

  test("excludes judgment-bearing fields and preserves neutral, complete, deduplicated evidence", () => {
    const forbidden = /finalEvidenceState|finalApplicability|reviewerOutcome|acceptedEvidence|rejectedEvidence|assessmentReason|correctionReason|genericFailureCategory|reviewerConfidence|provisionalReason|proposedApplicability|proposedEvidenceState|reviewStatus/;
    expect(JSON.stringify(packet)).not.toMatch(forbidden);
    for (const rule of packet.rules) {
      expect(rule.frozenMachineRowHash).toMatch(/^[0-9a-f]{64}$/);
      const keys = new Set<string>();
      for (const evidence of rule.originalPacketCandidateEvidence) {
        expect(evidence.sourceDocument).toEqual(packet.sourceDocument);
        expect(evidence.provenance).toMatchObject({ documentId: packet.sourceDocument.documentId, documentSha256: packet.sourceDocument.contentSha256, sourceType: "PDD" });
        const key = JSON.stringify(evidence);
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    }
  });

  test("response template is blank and validates against its schema", () => {
    const validate = new Ajv({ strict: false }).compile(schema);
    expect(validate(template)).toBe(true);
    expect(template.responses.map((response: any) => response.stableRuleId)).toEqual([...selectedRuleIds]);
    expect(template.responses.every((response: any) => response.expertAnalysis === null && response.applicabilityDetermination === null && response.evidenceSufficiency === null && response.supportingEvidence.length === 0 && response.missingEvidence.length === 0 && response.notes === null)).toBe(true);
  });

  test("regeneration is byte-for-byte stable and does not create reviewed truth", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-methodology-expert-"));
    try {
      const generatedSha = writeArtifacts(outputDir);
      expect(generatedSha).toBe(manifest.generatedPacketSha256);
      for (const file of ["review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json"]) {
        expect(fs.readFileSync(path.join(outputDir, file))).toEqual(fs.readFileSync(path.join(packetDir, file)));
      }
      expect(fs.existsSync(path.join(outputDir, "reviewed-truth.json"))).toBe(false);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  test("merged machine proposal and 39 reviewed decisions remain unchanged", () => {
    expect(manifest.historicalInputs.machineProposal.sha256).toBe("e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    const reviewedTruthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`)];
    const rows = reviewedTruthFiles.flatMap((file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8")).decisions.filter((row: any) => row.reviewStatus === "REVIEWED")).sort((a: any, b: any) => a.stableRuleId.localeCompare(b.stableRuleId));
    expect(rows).toHaveLength(39);
    expect(sha256(JSON.stringify(rows))).toBe("922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1");
    const inventory = manifest.mergedProvisionalScope.inventory;
    expect(inventory.provisionalRuleCount).toBe(19);
  });
});
