import fs from "node:fs";
import path from "node:path";

import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { auditEvidence, type MethodologyEvidenceAuditResult } from "@/lib/preverif/evidenceAudit";
import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const reviewedRuleIds = [
  "R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005",
  "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008",
] as const;

type JsonRecord = Record<string, any>;

function readJson(name: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as JsonRecord;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function evidenceRecords(result: MethodologyEvidenceAuditResult) {
  return result.evidence ?? (result.bestEvidenceQuote ? [{
    quote: result.bestEvidenceQuote,
    page: result.page,
    section: result.section,
    span: result.span ?? "",
  }] : []);
}

function sectionForPage(page: number): string {
  if (page === 12) return "2.1.4 Project Eligibility";
  if (page >= 61 && page <= 68) return "3.1 Application of Methodology";
  if (page <= 9) return "1.2 Standardized Benefit Metrics";
  return `Marcondes PDD page ${page}`;
}

function marcondesEvidenceDocument(): EvidenceDocument {
  const extraction = readJson("raw-document-extraction.json");
  const spans = extraction.pages.map((page: { pageNumber: number; text: string }) => {
    const text = page.pageNumber === 12
      ? page.text.match(/The project is eligible[\s\S]*?associated with deforestation\./)?.[0] ?? ""
      : page.text;
    return ({
    spanId: `marcondes-pdd:page:${page.pageNumber}:project-evidence`,
    docId: "marcondes-pdd",
    page: page.pageNumber,
    sectionId: sectionForPage(page.pageNumber),
    heading: sectionForPage(page.pageNumber),
    headingPath: [sectionForPage(page.pageNumber)],
    sectionPath: [sectionForPage(page.pageNumber)],
    blockType: "paragraph" as const,
    text,
    normalizedText: normalize(text).toLowerCase(),
    charStart: null,
    charEnd: null,
    reliability: "primary" as const,
    confidence: 1,
    });
  });
  return {
    docId: "marcondes-pdd",
    rawText: extraction.pages.map((page: { text: string }) => page.text).join("\f"),
    parserSource: "saved-document-extraction",
    parserAdapterId: "pymupdf",
    spans,
  };
}

describe("Marcondes VM0007 v1.8 post-998 validation", () => {
  it("prefers project evidence while preserving conservative reviewed-row behavior", async () => {
    const rules = (await loadMethodRules("VM0007", "v1-8")).rules;
    const gold = readJson("gold.json");
    const corrections = readJson("corrections.json");
    const reviewedIds = readJson("reviewedRuleIds.json");
    const previousMachine = readJson("machine-proposal.json");
    const audit = auditEvidence({
      rules,
      evidenceDocument: marcondesEvidenceDocument(),
      getContract: getVm0007EvidenceContract,
      normalizeRuleId: normalizeVm0007RuleId,
      versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
    });

    expect(rules).toHaveLength(58);
    expect(audit.results).toHaveLength(58);
    expect(audit.totalRules).toBe(58);
    const historicalReviewedIds = reviewedRuleIds.map((ruleId) => `Verra.AFOLU.VM0007.v1-8.${ruleId}`);
    expect(reviewedIds.reviewedRuleIds.slice(0, historicalReviewedIds.length)).toEqual(historicalReviewedIds);
    expect(corrections.reviewedRuleIds.slice(0, historicalReviewedIds.length)).toEqual(historicalReviewedIds);
    expect(gold.reviewedRuleIds.slice(0, historicalReviewedIds.length)).toEqual(historicalReviewedIds);

    const byRule = new Map(audit.results.map((result) => [normalizeVm0007RuleId(result.ruleId), result]));
    const previousByRule = new Map(previousMachine.rows.map((row: JsonRecord) => [row.ruleReference, row]));
    const goldByRule = new Map(gold.rows.map((row: JsonRecord) => [row.ruleReference, row]));
    const comparison = reviewedRuleIds.map((ruleId) => {
      const result = byRule.get(ruleId)!;
      const reviewed = goldByRule.get(ruleId)!;
      const previous = previousByRule.get(reviewed.ruleId)!;
      return {
        ruleId,
        previousStatus: previous.rawAuditStatus,
        newStatus: result.status,
        reviewedState: reviewed.finalEvidenceState,
        previousPage: previous.page,
        newPages: evidenceRecords(result).map((record) => record.page),
        acceptedPages: reviewed.acceptedEvidence.map((evidence: JsonRecord) => evidence.page),
      };
    });
    console.log("Marcondes post-998 validation", JSON.stringify(comparison, null, 2));

    const r1 = byRule.get("R-1-0001")!;
    const acceptedR1 = goldByRule.get("R-1-0001")!.acceptedEvidence[0];
    expect(r1.status).toBe("supported_by_pdd");
    expect(r1.page).toBe(12);
    expect(r1.section).toBe("2.1.4 Project Eligibility");
    expect(r1.span).toBe("marcondes-pdd:page:12:project-evidence");
    expect(normalize(r1.bestEvidenceQuote ?? "")).toContain(normalize(acceptedR1.quote));
    expect(r1.bestEvidenceQuote).not.toContain("…");
    expect(r1.evidence?.[0]?.page).toBe(12);
    expect(r1.evidence?.[0]?.span).toBe(r1.span);

    const conservativeFalsePromotions = [
      "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-6-0001", "R-6-0008",
    ];
    for (const ruleId of conservativeFalsePromotions) {
      expect(byRule.get(ruleId)?.status).not.toBe("supported_by_pdd");
    }

    for (const ruleId of reviewedRuleIds) {
      const reviewed = goldByRule.get(ruleId)!;
      if (reviewed.finalEvidenceState === "UNCLEAR") {
        expect(byRule.get(ruleId)?.status).not.toBe("supported_by_pdd");
      }
    }

    for (const ruleId of ["R-1-0002", "R-3-0005"]) {
      const result = byRule.get(ruleId)!;
      const accepted = goldByRule.get(ruleId)!.acceptedEvidence[0];
      const matchingRecord = evidenceRecords(result).find((record) => record.page === accepted.page);
      expect(matchingRecord).toBeDefined();
      expect(normalize(matchingRecord?.quote ?? "")).toContain(normalize(accepted.quote));
      expect(matchingRecord?.section).toEqual(expect.any(String));
      expect(matchingRecord?.span).toEqual(expect.any(String));
    }

    for (const ruleId of reviewedRuleIds.filter((id) => id !== "R-1-0001")) {
      const result = byRule.get(ruleId)!;
      const reviewed = goldByRule.get(ruleId)!;
      expect(result.bestEvidenceQuote ?? "").not.toContain("…");
      expect(evidenceRecords(result).every((record) => record.page !== null && record.section && record.span)).toBe(true);
      expect(result.page).toBe(evidenceRecords(result)[0]?.page ?? result.page);
      expect(result.section).toEqual(expect.any(String));
      expect(result.span).toEqual(expect.any(String));
    }

    const singleRuleAudit = (ruleId: string, text: string) => auditEvidence({
      rules: rules.filter((rule) => normalizeVm0007RuleId(rule.id) === ruleId),
      evidenceDocument: {
        docId: "synthetic-pdd",
        rawText: text,
        spans: [{
          spanId: "synthetic-pdd:span:1", docId: "synthetic-pdd", page: 1,
          headingPath: ["Project evidence"], sectionPath: ["Project evidence"], blockType: "paragraph",
          text, normalizedText: normalize(text).toLowerCase(), charStart: null, charEnd: null,
          reliability: "primary", confidence: 1,
        }],
      },
      getContract: getVm0007EvidenceContract,
      normalizeRuleId: normalizeVm0007RuleId,
      versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
    }).results[0];

    expect(singleRuleAudit("R-1-0004", "All property owners filed applications; the permits will be issued later.").status).not.toBe("supported_by_pdd");
    expect(singleRuleAudit("R-3-0001", "The alternative scenarios will be provided during the validation stage.").status).not.toBe("supported_by_pdd");
    expect(singleRuleAudit("R-1-0001", "Projects must meet the methodology forest definition.").status).not.toBe("supported_by_pdd");
    expect(singleRuleAudit("R-3-0001", "The alternative scenarios are listed in the methodology, but project analysis is pending.").status).not.toBe("supported_by_pdd");
    expect(singleRuleAudit("R-1-0001", "The methodology declares the forest definition, but the project evidence is not provided.").status).not.toBe("supported_by_pdd");
  });
});
