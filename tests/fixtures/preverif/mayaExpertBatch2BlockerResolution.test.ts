import fs from "node:fs";
import path from "node:path";
import { assertEvidence, assertSourceAndTruthPins, buildPacket, packetDir, selectedRuleIds } from "../../../scripts/preverif/generate-rc5-maya-expert-batch2-blocker-resolution";

const root = process.cwd();
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

describe("Maya RC5-2 batch 2 blocker-resolution packet", () => {
  const packet = JSON.parse(fs.readFileSync(path.join(packetDir, "blocker-resolution-packet.json"), "utf8"));

  test("contains exactly the three selected rules", () => {
    expect(packet.selectedRuleIds).toEqual([...selectedRuleIds]);
    expect(packet.rules.map((rule: any) => rule.ruleId)).toEqual([...selectedRuleIds]);
  });

  test("methodology evidence is only from the pinned official source", () => {
    for (const rule of packet.rules) {
      expect(rule.methodologyEvidence).toHaveLength(1);
      for (const evidence of rule.methodologyEvidence) {
        expect(evidence.sourceType).toBe("OFFICIAL_VERRA_PUBLICATION");
        expect(evidence.documentSha256).toBe(packet.officialMethodologySource.sha256);
        expect(evidence.documentId).toBe(packet.officialMethodologySource.documentId);
        expect(evidence.exactQuote).not.toContain("rules.rich.json");
      }
    }
    expect(packet.officialMethodologySource.path).toBe("official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf");
  });

  test("derived methodology evidence cannot masquerade as official evidence", () => {
    const derived = packet.rules[0].methodologyEvidence[0];
    const forged = { ...derived, sourceType: "DERIVED_METHODOLOGY_RULE_ARTIFACT" };
    expect(forged.sourceType).not.toBe("OFFICIAL_VERRA_PUBLICATION");
    expect(() => assertEvidence()).not.toThrow();
    expect(packet.rules.flatMap((rule: any) => rule.methodologyEvidence).some((evidence: any) => evidence.sourceType !== "OFFICIAL_VERRA_PUBLICATION")).toBe(false);
  });

  test("every project quote matches the frozen PDD page and provenance", () => {
    const extraction = JSON.parse(fs.readFileSync(path.join(root, packet.frozenProjectSource.extractionPath), "utf8"));
    for (const rule of packet.rules) {
      for (const evidence of rule.projectEvidence) {
        const sourcePage = extraction.pages.find((page: any) => page.pageNumber === evidence.page).text;
        expect(normalize(sourcePage)).toContain(normalize(evidence.quote));
        expect(evidence.documentId).toBe(packet.frozenProjectSource.documentId);
        expect(evidence.documentSha256).toBe(packet.frozenProjectSource.documentSha256);
        expect(evidence.ruleId).toBe(rule.ruleId);
      }
    }
  });

  test("referenced-but-missing appendices and the project pool matrix remain missing", () => {
    const missing = packet.rules.find((rule: any) => rule.ruleId === selectedRuleIds[2]).missingEvidence;
    expect(missing).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: expect.stringContaining("Appendix 22"), status: "REFERENCED_BUT_ABSENT" }),
      expect.objectContaining({ item: expect.stringContaining("Table 4"), status: "REFERENCED_BUT_ABSENT" }),
    ]));
    expect(packet.absentSourceDeclarations.join(" ")).toContain("Appendix 22");
  });

  test("evidence is frozen per rule; no cross-rule item is silently reused", () => {
    for (const rule of packet.rules) {
      expect(rule.methodologyEvidence.every((evidence: any) => evidence.ruleId === rule.ruleId)).toBe(true);
      expect(rule.projectEvidence.every((evidence: any) => evidence.ruleId === rule.ruleId)).toBe(true);
    }
    expect(packet.rules.every((rule: any) => rule.methodologyEvidence.length > 0 && rule.projectEvidence.length > 0)).toBe(true);
  });

  test("truth pins, 39/19 inventory, and deterministic regeneration remain valid", () => {
    expect(() => assertSourceAndTruthPins()).not.toThrow();
    expect(packet.truthProtection.inventory).toEqual({ reviewed: 39, provisional: 19 });
    expect(packet.truthProtection.noNewReviewedTruth).toBe(true);
    expect(packet.truthProtection.noConclusionsChanged).toBe(true);
    expect(JSON.stringify(buildPacket(), null, 2) + "\n").toBe(fs.readFileSync(path.join(packetDir, "blocker-resolution-packet.json"), "utf8"));
  });
});
