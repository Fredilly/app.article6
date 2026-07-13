/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";

import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { auditEvidence, type EvidenceAuditStatus } from "@/lib/preverif/evidenceAudit";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const reviewedRuleIds = [
  "R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008",
  "R-1-0003", "R-1-0006", "R-1-0007", "R-1-0008", "R-1-0009", "R-1-0010", "R-1-0011", "R-1-0012", "R-1-0013", "R-1-0014", "R-1-0015",
  "R-2-0001", "R-2-0002", "R-2-0006", "R-2-0008", "R-2-0016", "R-3-0002", "R-3-0006", "R-2-0003", "R-2-0004", "R-2-0009", "R-2-0010",
  "R-2-0011", "R-2-0012", "R-2-0013", "R-2-0014", "R-2-0015", "R-3-0003", "R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002",
  "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005",
] as const;

type JsonRecord = Record<string, any>;

function readJson(name: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as JsonRecord;
}

function marcondesEvidenceDocument(): EvidenceDocument {
  const extraction = readJson("raw-document-extraction.json");
  const spans = extraction.pages.map((page: { pageNumber: number; text: string }) => ({
    spanId: `marcondes-pdd:page:${page.pageNumber}:project-evidence`,
    docId: "marcondes-pdd",
    page: page.pageNumber,
    sectionId: `Marcondes PDD page ${page.pageNumber}`,
    heading: `Marcondes PDD page ${page.pageNumber}`,
    headingPath: [`Marcondes PDD page ${page.pageNumber}`],
    sectionPath: [`Marcondes PDD page ${page.pageNumber}`],
    blockType: "paragraph" as const,
    text: page.pageNumber === 12
      ? page.text.match(/The project is eligible[\s\S]*?associated with deforestation\./)?.[0] ?? ""
      : page.text,
    normalizedText: page.text.toLowerCase(),
    charStart: null,
    charEnd: null,
    reliability: "primary" as const,
    confidence: 1,
  }));
  return {
    docId: "marcondes-pdd",
    rawText: extraction.pages.map((page: { text: string }) => page.text).join("\f"),
    parserSource: "saved-document-extraction",
    parserAdapterId: "pymupdf",
    spans,
  };
}

function stateForStatus(status: EvidenceAuditStatus): "FOUND" | "UNCLEAR" | "MISSING" | "N/A" {
  if (status === "supported_by_pdd") return "FOUND";
  if (status === "missing_evidence") return "MISSING";
  if (status === "not_applicable") return "N/A";
  return "UNCLEAR";
}

describe("Marcondes reviewed gold comparison", () => {
  it("evaluates every reviewed row and reports exact matches, mismatches, and corrected false FOUND cases", async () => {
    const rules = (await loadMethodRules("VM0007", "v1-8")).rules;
    const gold = readJson("gold.json");
    const previous = readJson("machine-proposal.json");
    const audit = auditEvidence({
      rules,
      evidenceDocument: marcondesEvidenceDocument(),
      getContract: getVm0007EvidenceContract,
      normalizeRuleId: normalizeVm0007RuleId,
      versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
    });
    const goldByRule = new Map(gold.rows.map((row: JsonRecord) => [row.ruleReference, row]));
    const previousByRule = new Map(previous.rows.map((row: JsonRecord) => [row.ruleReference, row]));
    const comparison = reviewedRuleIds.map((ruleId) => {
      const result = audit.results.find((row) => row.ruleId === ruleId)!;
      const reviewed = goldByRule.get(ruleId)!;
      const prior = previousByRule.get(`Verra.AFOLU.VM0007.v1-8.${ruleId}`)!;
      const machineState = stateForStatus(result.status);
      return {
        ruleId,
        before: prior.rawAuditStatus,
        after: result.status,
        gold: reviewed.finalEvidenceState,
        exact: machineState === reviewed.finalEvidenceState,
        correctedFalseFound: prior.rawAuditStatus === "supported_by_pdd" && result.status !== "supported_by_pdd",
        evidenceTypes: result.evidence?.map((evidence) => evidence.evidenceType),
      };
    });
    const mismatches = comparison.filter((row) => !row.exact);
    const corrections = comparison.filter((row) => row.correctedFalseFound);
    const totals = Object.fromEntries([
      "supported_by_pdd", "partially_supported", "missing_evidence", "not_applicable", "manual_review_needed",
    ].map((status) => [status, audit.results.filter((row) => row.status === status).length]));

    console.log("Marcondes reviewed gold comparison", JSON.stringify({
      reviewed: comparison.length,
      exactMatches: comparison.length - mismatches.length,
      mismatches,
      correctedFalseFound: corrections.map((row) => row.ruleId),
      totals,
    }, null, 2));

    expect(audit.results).toHaveLength(58);
    expect(comparison).toHaveLength(48);
    expect(comparison.length - mismatches.length).toBeGreaterThanOrEqual(33);
    expect(comparison.length - mismatches.length).toBe(33);
    const reconciliation = readJson("mismatch-reconciliation.json");
    expect(reconciliation.rows).toHaveLength(15);
    expect(new Set(reconciliation.rows.map((row: JsonRecord) => row.ruleId)).size).toBe(15);
    const stableRuleId = (ruleId: string) => ruleId.startsWith("Verra.") ? ruleId : `Verra.AFOLU.VM0007.v1-8.${ruleId}`;
    expect(mismatches.map((row) => stableRuleId(row.ruleId)).sort()).toEqual(reconciliation.rows.map((row: JsonRecord) => row.ruleId).sort());
    for (const mismatch of mismatches) {
      const record = reconciliation.rows.find((row: JsonRecord) => row.ruleId === stableRuleId(mismatch.ruleId))!;
      const goldRow = goldByRule.get(mismatch.ruleId)!;
      expect(record.machineState).toBe(stateForStatus(mismatch.after));
      expect(record.goldState).toBe(mismatch.gold);
      expect(record.requirementReviewed).toBe(goldRow.requirement);
      expect(record.methodologyTraceability).toEqual(goldRow.methodologyTraceability);
      expect(record.pagesInspected).toEqual([...new Set(goldRow.acceptedEvidence.map((evidence: JsonRecord) => evidence.page))]);
      expect(record.acceptedEvidenceReferences).toEqual(goldRow.acceptedEvidence.map((evidence: JsonRecord) => ({ page: evidence.page, section: evidence.section, spanId: evidence.spanId, quote: evidence.quote })));
      expect(record.rejectedEvidenceReferences).toEqual(goldRow.rejectedEvidence.map((evidence: JsonRecord) => ({ page: evidence.page, section: evidence.section, spanId: evidence.spanId, quote: evidence.quote, rejectionReason: evidence.rejectionReason })));
      expect(record.failureClassification).toEqual(expect.stringMatching(/^MACHINE_/));
      expect(record.decision).toBe("GOLD_RETAINED");
      expect(record.reconciliationRationale).toEqual(expect.any(String));
    }
    expect(totals.supported_by_pdd).toBeGreaterThan(0);
    expect(totals.partially_supported).toBeLessThan(57);
    expect(totals.not_applicable).toBeGreaterThan(0);
    expect(corrections.length).toBeGreaterThan(0);
    expect(comparison.some((row) => row.ruleId === "R-4-0001" && row.gold === "FOUND" && row.after === "partially_supported")).toBe(true);
    expect(comparison.filter((row) => row.gold === "N/A" && row.after === "not_applicable").length).toBeGreaterThan(0);
  });
});
