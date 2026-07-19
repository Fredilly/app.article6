import Ajv from "ajv/dist/2020";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertSourceAndTruthPins, buildPacket, packetDir, selectedRuleIds, validatePacket } from "../../../scripts/preverif/generate-rc5-maya-expert-batch2-blocker-resolution";

const root = process.cwd();
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const packetPath = path.join(packetDir, "blocker-resolution-packet.json");
const readPacket = () => JSON.parse(fs.readFileSync(packetPath, "utf8"));
const readOfficialExtraction = () => JSON.parse(fs.readFileSync(path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json"), "utf8"));
const readPddExtraction = () => JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json"), "utf8"));
const frozenMachineRowHashes = JSON.parse(fs.readFileSync(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/integration-manifest.json"), "utf8")).rules;

function canonicalDecision(ruleId: string) {
  return {
    stableRuleId: ruleId,
    machineRowSha256: frozenMachineRowHashes[ruleId].frozenMachineRowHash,
    reviewStatus: "REVIEWED",
    expertReviewRequired: false,
    finalEvidenceState: "FOUND",
    finalApplicability: "APPLICABLE",
    reviewerOutcome: "CONFORMS",
    acceptedEvidence: [],
    rejectedEvidence: [],
    contradictionState: "NONE",
    draftFindingCandidate: null,
    assessmentReason: "The frozen evidence resolves the rule.",
    gap: null,
    clientAction: null,
    correctionReason: "The independent reviewer resolved the blocker from frozen evidence.",
    provisionalReason: null,
    genericFailureCategory: "NONE",
    reviewerConfidence: "HIGH",
  };
}

describe("Maya RC5-2 batch 2 blocker-resolution packet", () => {
  test("contains exactly the three selected rules", () => {
    const packet = readPacket();
    expect(packet.selectedRuleIds).toEqual([...selectedRuleIds]);
    expect(packet.rules.map((rule: any) => rule.ruleId)).toEqual([...selectedRuleIds]);
    expect(packet.rules).toHaveLength(3);
  });

  test("response schema allows both canonical adjudication outcomes", () => {
    const schema = JSON.parse(fs.readFileSync(path.join(packetDir, "independent-review-response-schema.json"), "utf8"));
    const validate = new Ajv({ strict: false }).compile(schema);
    const unresolved = { schemaVersion: schema.properties.schemaVersion.const, responses: Object.fromEntries(selectedRuleIds.map((id) => [id, { reviewStatus: "UNRESOLVED", evidenceAssessment: "The official passage is verified but a project blocker remains.", finalRuleDecision: null, remainingBlockers: ["Provide the missing attachment."], notes: "Keep this rule unresolved." }])) };
    const resolved = { schemaVersion: schema.properties.schemaVersion.const, responses: Object.fromEntries(selectedRuleIds.map((id) => [id, { reviewStatus: "RESOLVED", evidenceAssessment: "The frozen evidence resolves the blocker.", finalRuleDecision: canonicalDecision(id), remainingBlockers: [], notes: "Resolved from frozen evidence only." }])) };
    expect(validate(unresolved)).toBe(true);
    expect(validate(resolved)).toBe(true);
    expect(schema.$defs.canonicalDecision_Verra_AFOLU_VM0007_v1_8_R_1_0012.properties.stableRuleId.const).toBe(selectedRuleIds[0]);
    expect(schema.$defs.canonicalDecision_Verra_AFOLU_VM0007_v1_8_R_1_0012.properties.machineRowSha256.const).toBe(frozenMachineRowHashes[selectedRuleIds[0]].frozenMachineRowHash);
    const invalidResolved = clone(resolved);
    invalidResolved.responses[selectedRuleIds[0]].finalRuleDecision = null;
    expect(validate(invalidResolved)).toBe(false);
    const invalidUnresolved = clone(unresolved);
    invalidUnresolved.responses[selectedRuleIds[0]].remainingBlockers = [];
    expect(validate(invalidUnresolved)).toBe(false);
    const swapped = clone(resolved);
    swapped.responses[selectedRuleIds[1]].finalRuleDecision = clone(swapped.responses[selectedRuleIds[0]].finalRuleDecision);
    expect(validate(swapped)).toBe(false);
    const changedRuleId = clone(resolved);
    changedRuleId.responses[selectedRuleIds[0]].finalRuleDecision.stableRuleId = selectedRuleIds[1];
    expect(validate(changedRuleId)).toBe(false);
    const fakeMachineHash = clone(resolved);
    fakeMachineHash.responses[selectedRuleIds[0]].finalRuleDecision.machineRowSha256 = "a".repeat(64);
    expect(validate(fakeMachineHash)).toBe(false);
    const otherMachineHash = clone(resolved);
    otherMachineHash.responses[selectedRuleIds[0]].finalRuleDecision.machineRowSha256 = frozenMachineRowHashes[selectedRuleIds[1]].frozenMachineRowHash;
    expect(validate(otherMachineHash)).toBe(false);
  });

  test("methodology evidence is only from the pinned official source and matches its claimed page", () => {
    const packet = readPacket();
    const extraction = readOfficialExtraction();
    expect(packet.officialMethodologySource.extractionSha256).toBeTruthy();
    for (const rule of packet.rules) {
      expect(rule.methodologyEvidence).toHaveLength(1);
      for (const evidence of rule.methodologyEvidence) {
        expect(evidence.sourceType).toBe("OFFICIAL_VERRA_PUBLICATION");
        expect(evidence.documentSha256).toBe(packet.officialMethodologySource.sha256);
        expect(evidence.documentId).toBe(packet.officialMethodologySource.documentId);
        expect(normalize(extraction.pages.find((page: any) => page.pageNumber === evidence.page).text)).toContain(normalize(evidence.exactQuote));
      }
    }
  });

  test("official quote, page, extraction, and source-type mutations fail closed", () => {
    const packet = readPacket();
    const alteredQuote = clone(packet);
    alteredQuote.rules[0].methodologyEvidence[0].exactQuote += " altered";
    expect(() => validatePacket(alteredQuote)).toThrow();
    const wrongPage = clone(packet);
    wrongPage.rules[0].methodologyEvidence[0].page = 18;
    expect(() => validatePacket(wrongPage)).toThrow();
    const derivedSource = clone(packet);
    derivedSource.rules[0].methodologyEvidence[0].sourceType = "DERIVED_METHODOLOGY_RULE_ARTIFACT";
    expect(() => validatePacket(derivedSource)).toThrow();
    const alteredExtraction = readOfficialExtraction();
    alteredExtraction.pages[16].text += " altered";
    expect(() => validatePacket(packet, { officialExtraction: alteredExtraction, officialExtractionBytes: Buffer.from(`${JSON.stringify(alteredExtraction, null, 2)}\n`) })).toThrow();
  });

  test("project evidence matches frozen PDD provenance and Maya extraction mutations fail closed", () => {
    const packet = readPacket();
    const pdd = readPddExtraction();
    for (const rule of packet.rules) {
      for (const evidence of rule.projectEvidence) {
        const sourcePage = pdd.pages.find((page: any) => page.pageNumber === evidence.page).text;
        expect(normalize(sourcePage)).toContain(normalize(evidence.quote));
        expect(evidence.documentId).toBe(packet.frozenProjectSource.documentId);
        expect(evidence.documentSha256).toBe(packet.frozenProjectSource.documentSha256);
        expect(evidence.ruleId).toBe(rule.ruleId);
      }
    }
    const originalPddBytes = fs.readFileSync(path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json"), "utf8");
    const formattingOnlyBytes = Buffer.from(originalPddBytes.replace(/\n  /g, "\n    "));
    expect(() => validatePacket(packet, { pddExtractionBytes: formattingOnlyBytes })).toThrow();
    const mutatedPdd = clone(pdd);
    mutatedPdd.pages.find((page: any) => page.pageNumber === 84).text = "mutated project source";
    expect(() => validatePacket(packet, { pdd: mutatedPdd, pddExtractionBytes: Buffer.from(`${JSON.stringify(mutatedPdd, null, 2)}\n`) })).toThrow();
  });

  test("cross-rule methodology and project evidence reuse fails even when identity is altered", () => {
    const packet = readPacket();
    const copiedMethodology = clone(packet);
    copiedMethodology.rules[1].methodologyEvidence[0] = clone(copiedMethodology.rules[0].methodologyEvidence[0]);
    expect(() => validatePacket(copiedMethodology)).toThrow();
    const deceptivelyRelabeledMethodology = clone(packet);
    deceptivelyRelabeledMethodology.rules[1].methodologyEvidence[0] = clone(deceptivelyRelabeledMethodology.rules[0].methodologyEvidence[0]);
    deceptivelyRelabeledMethodology.rules[1].methodologyEvidence[0].ruleId = selectedRuleIds[1];
    expect(() => validatePacket(deceptivelyRelabeledMethodology)).toThrow();
    const copiedProject = clone(packet);
    copiedProject.rules[1].projectEvidence[0] = clone(copiedProject.rules[0].projectEvidence[0]);
    expect(() => validatePacket(copiedProject)).toThrow();
  });

  test("truth pins, 39/19 inventory, no reviewed truth, and deterministic artifacts remain valid", async () => {
    const packet = readPacket();
    const storedExpert = JSON.parse(fs.readFileSync(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/independent-expert-response.json"), "utf8"));
    expect(Object.fromEntries(packet.currentExpertConclusions.map((item: any) => { const { ruleId, ...conclusion } = item; return [ruleId, conclusion]; }))).toEqual(storedExpert.responses);
    expect(() => assertSourceAndTruthPins()).not.toThrow();
    expect(packet.truthProtection.inventory).toEqual({ reviewed: 39, provisional: 19 });
    expect(packet.truthProtection.noNewReviewedTruth).toBe(true);
    expect(packet.truthProtection.noConclusionsChanged).toBe(true);
    expect(fs.existsSync(path.join(packetDir, "reviewed-truth.json"))).toBe(false);
    const beforeExtraction = fs.readFileSync(path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json"));
    execFileSync("npx", ["tsx", "scripts/preverif/generate-rc5-maya-expert-batch2-blocker-resolution.ts"], { cwd: root, stdio: "pipe" });
    expect(fs.readFileSync(path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json"))).toEqual(beforeExtraction);
    expect(JSON.stringify(buildPacket(), null, 2) + "\n").toBe(fs.readFileSync(packetPath, "utf8"));
  });
});
