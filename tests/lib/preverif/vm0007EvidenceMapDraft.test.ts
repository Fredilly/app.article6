import { buildVm0007EvidenceMapDraft, mapVm0007DraftStatus } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";

const sourceDocument = { documentId: "pdd-1", documentName: "project-pdd.pdf", contentSha256: null };
const rules: RuleSummary[] = Array.from({ length: 58 }, (_, index) => ({ id: `R-${String(index + 1).padStart(2, "0")}-0001`, title: `Rule ${index + 1}`, snippet: `Requirement ${index + 1}`, text: `Requirement ${index + 1}`, tags: [] }));

function result(ruleId: string, status: MethodologyEvidenceAuditResult["status"], index = 1): MethodologyEvidenceAuditResult {
  return { ruleId, stableId: ruleId, title: ruleId, ruleLogic: "Requirement", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", versionMatch: true, status, bestEvidenceQuote: status === "missing_evidence" ? null : `Project evidence ${ruleId}`, page: 2, section: "S-1 Project evidence", span: `span-${index}`, reasonSelected: "selected", assessmentReason: status === "partially_supported" ? "Support is incomplete." : "Assessment", gap: status === "missing_evidence" ? "Add evidence." : "", clientAction: "Review evidence.", confidence: "medium" };
}

function audit(results: MethodologyEvidenceAuditResult[]): MethodologyEvidenceAuditSummary {
  return { auditStatus: "AUDITED", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", versionMatch: true, results, totalRules: 58, totals: { supported_by_pdd: 0, partially_supported: 0, missing_evidence: 0, not_applicable: 0, manual_review_needed: 0 } };
}

describe("VM0007 v1.8 draft Evidence Map", () => {
  it("creates 58 rows once, in canonical rulebook order", () => {
    const built = buildVm0007EvidenceMapDraft({ auditId: "audit-1", generatedAt: "2026-07-11T00:00:00.000Z", rules, audit: audit(rules.map((rule, index) => result(rule.id, "supported_by_pdd", index))), sourceDocument });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.package.rows).toHaveLength(58);
    expect(built.package.rows.map((row) => row.ruleReference)).toEqual(rules.map((rule) => rule.id));
    expect(new Set(built.package.rows.map((row) => row.ruleReference)).size).toBe(58);
  });

  it("maps evidence statuses without fabricating or finalizing evidence", () => {
    const supported = mapVm0007DraftStatus("supported_by_pdd", result("R-01-0001", "supported_by_pdd"), sourceDocument);
    expect(supported.upstreamStatus).toBe("FOUND");
    expect(supported.accepted?.provenance.spanId).toBe("span-1");
    const partial = mapVm0007DraftStatus("partially_supported", result("R-01-01-0001", "partially_supported"), sourceDocument);
    expect(partial.upstreamStatus).toBe("UNCLEAR");
    const missing = mapVm0007DraftStatus("missing_evidence", result("R-01-0001", "missing_evidence"), sourceDocument);
    expect(missing.accepted).toBeNull();
    const manual = mapVm0007DraftStatus("manual_review_needed", result("R-01-0001", "manual_review_needed"), sourceDocument);
    expect(manual.upstreamStatus).toBe("UNCLEAR");
    expect(manual.rejected?.reason).toContain("Assessment");
    const na = mapVm0007DraftStatus("not_applicable", result("R-01-0001", "not_applicable"), sourceDocument);
    expect(na.upstreamStatus).not.toBe("MISSING");
  });

  it.each([
    ["version mismatch", { ...audit([]), versionMatch: false }],
    ["missing result", audit(rules.slice(1).map((rule) => result(rule.id, "missing_evidence")))],
    ["unknown result", audit([...rules.slice(0, 57).map((rule) => result(rule.id, "missing_evidence")), result("UNKNOWN", "missing_evidence")])],
  ])("fails closed for %s", (_, invalidAudit) => {
    const built = buildVm0007EvidenceMapDraft({ auditId: "audit-2", generatedAt: "2026-07-11T00:00:00.000Z", rules, audit: invalidAudit, sourceDocument });
    expect(built.ok).toBe(false);
  });
});
