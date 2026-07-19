import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Ajv from "ajv/dist/2020";
import { packetDir, selectedRuleIds, verifyAuthoritativeExcerpt, verifyDerivedTextAgreement, writeArtifacts } from "../../../scripts/preverif/generate-rc5-maya-methodology-expert-finalization-batch2";

/* eslint-disable @typescript-eslint/no-explicit-any */

const root = process.cwd();
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const packetPath = path.join(packetDir, "review-packet.json");
const templatePath = path.join(packetDir, "review-template.json");
const schemaPath = path.join(packetDir, "review-response-schema.json");
const templateSchemaPath = path.join(packetDir, "review-template-schema.json");
const manifestPath = path.join(packetDir, "manifest.json");

describe("Maya methodology-expert finalization batch 2", () => {
  const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const templateSchema = JSON.parse(fs.readFileSync(templateSchemaPath, "utf8"));
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

  test("contains actual primary methodology context for every expert question", () => {
    const ruleById = Object.fromEntries(packet.rules.map((rule: any) => [rule.stableRuleId, rule]));
    for (const id of selectedRuleIds) {
      const rule = ruleById[id];
      expect(rule.methodologyExcerpts.length).toBeGreaterThan(1);
      for (const excerpt of rule.methodologyExcerpts) {
        expect(excerpt.sourceType).toBe("DERIVED_METHODOLOGY_RULE_ARTIFACT");
        expect(excerpt.authoritativeSourceVerification).toBe("NOT_AVAILABLE_IN_REPOSITORY");
        expect(excerpt.sourceDocumentName).toContain("derived methodology rule artifact");
        expect(excerpt.methodologyPackIdentity).toEqual({ repository: "Fredilly/article6-methodologies", ref: "87eef90379f06df40a917894a159d10a5d4c2703", tag: "methodologies-pack-87eef90379f06df40a917894a159d10a5d4c2703" });
        expect(excerpt.methodologyVersion).toBe("v1.8");
        expect(excerpt.sourcePath).toBe("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
        expect(excerpt.sourceSha256).toBe("9fceaa1dc458c847c1236fad73215f56b924ebbec794850b60c0510ace7d0e49");
        expect(excerpt.derivedRuleArtifactPath).toBe(excerpt.sourcePath);
        expect(excerpt.derivedRuleArtifactSha256).toBe(excerpt.sourceSha256);
        expect(excerpt.derivedRuleId).toBe(excerpt.ruleId);
        expect(excerpt.sectionNumber).toEqual(expect.any(String));
        expect(excerpt.sectionTitle).toEqual(expect.any(String));
        expect(excerpt.exactText).not.toMatch(/^Section context:/);
        expect(excerpt.exactText.length).toBeGreaterThan(20);
      }
    }
    expect(ruleById[selectedRuleIds[0]].methodologyExcerpts.map((excerpt: any) => excerpt.ruleId)).toEqual(expect.arrayContaining(["Verra.AFOLU.VM0007.v1-8.R-1-0002", "Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0014", "Verra.AFOLU.VM0007.v1-8.R-2-0006"]));
    expect(ruleById[selectedRuleIds[1]].methodologyExcerpts.map((excerpt: any) => excerpt.ruleId)).toEqual(expect.arrayContaining(["Verra.AFOLU.VM0007.v1-8.R-1-0013", "Verra.AFOLU.VM0007.v1-8.R-2-0016"]));
    expect(ruleById[selectedRuleIds[2]].methodologyExcerpts.map((excerpt: any) => excerpt.ruleId)).toEqual(expect.arrayContaining(["Verra.AFOLU.VM0007.v1-8.R-2-0007", "Verra.AFOLU.VM0007.v1-8.R-2-0008", "Verra.AFOLU.VM0007.v1-8.R-2-0012"]));
  });

  test("fails closed for missing, altered, or mismatched authoritative methodology sources", () => {
    const exact = "authoritative VM0007 excerpt";
    const authoritative = Buffer.from(`prefix ${exact} suffix`);
    expect(() => verifyAuthoritativeExcerpt(null, "0".repeat(64), exact)).toThrow(/authoritative.*unavailable/i);
    expect(() => verifyAuthoritativeExcerpt(authoritative, "0".repeat(64), exact)).toThrow(/SHA changed/i);
    expect(() => verifyAuthoritativeExcerpt(authoritative, sha256(authoritative), "altered excerpt")).toThrow(/not an exact substring/i);
    expect(() => verifyDerivedTextAgreement("derived text", "authoritative text")).toThrow(/disagrees/i);
    expect(() => verifyDerivedTextAgreement(exact, exact)).not.toThrow();
  });

  test("excludes judgment-bearing fields and preserves neutral, complete, deduplicated evidence", () => {
    const forbidden = /ruleSummaryForOrientation|methodology\.logic|interpretationSummary|expectedAnswer|recommendedApplicability|finalEvidenceState|finalApplicability|reviewerOutcome|acceptedEvidence|rejectedEvidence|assessmentReason|correctionReason|genericFailureCategory|reviewerConfidence|provisionalReason|proposedApplicability|proposedEvidenceState|currentApplicability|currentEvidenceState|currentReviewerOutcome|reviewStatus/;
    expect(JSON.stringify(packet)).not.toMatch(forbidden);
    expect(packet.methodologySourceWarning).toMatch(/official VM0007 v1\.8 publication/i);
    expect(manifest.methodologySourceProvenance).toMatchObject({ sourceType: "DERIVED_METHODOLOGY_RULE_ARTIFACT", authoritativeSourceAvailable: false });
    for (const rule of packet.rules) {
      expect(rule.frozenMachineRowHash).toMatch(/^[0-9a-f]{64}$/);
      const keys = new Set<string>();
      for (const evidence of rule.originalPacketCandidateEvidence) {
        expect(evidence.sourceDocument).toEqual(packet.sourceDocument);
        expect(evidence.provenance).toMatchObject({ documentId: packet.sourceDocument.documentId, documentSha256: packet.sourceDocument.contentSha256, sourceType: "PDD" });
        expect(evidence.pageReferenceType).toBe("INHERITED_EXTRACTION_PAGE");
        expect(evidence.sourceAudit).toMatchObject({ originalPacketPage: evidence.page, pageWasNotNormalized: true });
        if (/(?:^|\s)(?:83|84|85|88)(?:\s|$)/.test(evidence.quote)) expect(evidence.displayedDocumentPage).toBeUndefined();
        const key = JSON.stringify(evidence);
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    }
  });

  test("blank template is transport-valid but cannot satisfy the completed response contract", () => {
    const validateTemplate = new Ajv({ strict: false }).compile(templateSchema);
    const validateCompleted = new Ajv({ strict: false }).compile(schema);
    expect(validateTemplate(template)).toBe(true);
    expect(validateCompleted(template)).toBe(false);
    expect(Object.keys(template.responses)).toEqual([...selectedRuleIds]);
    expect(Object.values(template.responses).every((response: any) => response.expertAnalysis === null && response.applicabilityDetermination === null && response.evidenceSufficiency === null && response.supportingMethodologyEvidence.length === 0 && response.supportingProjectEvidence.length === 0 && response.missingEvidence.length === 0 && response.reasoning === null && response.notes === null)).toBe(true);
  });

  test("completed response contract rejects missing, duplicate, blank, unsupported, and unstructured responses", () => {
    const validate = new Ajv({ strict: false }).compile(schema);
    const methodologyEvidence = { quote: packet.rules[0].methodologyExcerpts[0].exactText, sourcePath: packet.rules[0].methodologyExcerpts[0].sourcePath, sourceSha256: packet.rules[0].methodologyExcerpts[0].sourceSha256, pageStart: 13, pageEnd: 14, sectionNumber: "4", sectionTitle: "Applicability Conditions" };
    const projectEvidence = { quote: packet.rules[0].originalPacketCandidateEvidence[0].quote, page: 1, sectionHeading: packet.rules[0].originalPacketCandidateEvidence[0].sectionHeading, spanId: packet.rules[0].originalPacketCandidateEvidence[0].spanId, documentId: packet.sourceDocument.documentId, documentSha256: packet.sourceDocument.contentSha256 };
    const completed = { schemaVersion: schema.properties.schemaVersion.const, responses: Object.fromEntries(selectedRuleIds.map((id) => [id, { expertAnalysis: "The expert analysis establishes the methodology chain and distinguishes the activity category from project evidence.", applicabilityDetermination: "UNKNOWN", evidenceSufficiency: "PARTIALLY_SUFFICIENT", supportingMethodologyEvidence: [methodologyEvidence], supportingProjectEvidence: [projectEvidence], missingEvidence: ["Confirm the applicable activity category from the governing project records."], reasoning: "The evidence must be evaluated against the exact applicability chain before reaching a determination.", notes: null }])) };
    expect(validate(completed)).toBe(true);
    const missing = JSON.parse(JSON.stringify(completed));
    delete missing.responses[selectedRuleIds[2]];
    expect(validate(missing)).toBe(false);
    const blank = JSON.parse(JSON.stringify(completed));
    blank.responses[selectedRuleIds[0]].expertAnalysis = "";
    expect(validate(blank)).toBe(false);
    const unsupported = JSON.parse(JSON.stringify(completed));
    unsupported.responses[selectedRuleIds[0]].applicabilityDetermination = "MAYBE";
    expect(validate(unsupported)).toBe(false);
    const badEvidence = JSON.parse(JSON.stringify(completed));
    badEvidence.responses[selectedRuleIds[0]].supportingMethodologyEvidence = [{ quote: "only a quote" }];
    expect(validate(badEvidence)).toBe(false);
    const duplicateArray = { schemaVersion: completed.schemaVersion, responses: [{ stableRuleId: selectedRuleIds[0] }, { stableRuleId: selectedRuleIds[0] }, { stableRuleId: selectedRuleIds[2] }] };
    expect(validate(duplicateArray)).toBe(false);
  });

  test("regeneration is byte-for-byte stable and does not create reviewed truth", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "maya-methodology-expert-"));
    try {
      const generatedSha = writeArtifacts(outputDir);
      expect(generatedSha).toBe(manifest.generatedPacketSha256);
      for (const file of ["review-packet.json", "review-template.json", "review-template-schema.json", "review-response-schema.json", "manifest.json"]) {
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
