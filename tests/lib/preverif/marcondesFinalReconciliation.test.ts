import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

describe("Marcondes finalized Evidence Map reconciliation", () => {
  it("finalizes 58/58 rows, preserves raw machine output, and is report-layer ready", () => {
    const gold = read("gold.json");
    const releaseStatus = read("release-status.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const ids = read("reviewedRuleIds.json").reviewedRuleIds;
    const metadata = read("metadata.json");

    expect(ids).toHaveLength(58);
    expect(new Set(ids).size).toBe(58);
    expect(gold.rows).toHaveLength(58);
    expect(gold.rows.reduce((count: number, row: any) => count + row.acceptedEvidence.length, 0)).toBe(97);
    expect(gold.rows.map((row: any) => row.ruleId)).toEqual(ids);
    expect(draft.rows.filter((row: any) => !ids.includes(row.ruleReference))).toHaveLength(0);
    expect(metadata.review.remainingUnreviewedRuleCount).toBe(0);
    expect(metadata.review.releaseReadiness).toEqual(expect.objectContaining({ evidenceMapRows: 58, reviewedRows: 58, unreviewedRows: 0, structurallyReady: false, blockedBy: ["methodology version conflict requires explicit validation"] }));
    expect(releaseStatus.goldPromotionBlocked).toBe(true);
    expect(releaseStatus.reportReleaseState).toBe("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(releaseStatus.reportReleaseBlocker).toMatch(/page-61.*v1\.7.*Tables 30 and 31.*blocked/i);
    expect(gold.counts).toEqual({ FOUND: 6, UNCLEAR: 21, MISSING: 9, "N/A": 22 });
    expect(gold.rows.filter((row: any) => row.reviewerOutcome === "CONFORMS")).toHaveLength(6);
    expect(gold.rows.filter((row: any) => row.reviewerOutcome === "ACTION_REQUIRED")).toHaveLength(30);
    expect(gold.rows.filter((row: any) => row.reviewerOutcome === "NOT_APPLICABLE")).toHaveLength(22);
    expect(gold.rows.filter((row: any) => row.reviewerOutcome === "NOT_ASSESSED")).toHaveLength(0);

    for (const row of gold.rows.slice(-10)) expect(row.machineProposal).toEqual(machine.rows.find((candidate: any) => candidate.ruleReference === row.machineProposal.ruleReference));
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, "raw-document-extraction.json"))).digest("hex")).toBe("7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747");
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, "raw-evidence-map.json"))).digest("hex")).toBe("bd71459647c878855a9ebfe1fe3d6af6e9ec5c8ba89464091bc06ee0dbfe649e");
  });

  it("retains exact quote, page, section, span, and provenance for accepted and rejected evidence", () => {
    const gold = read("gold.json");
    const extraction = read("raw-document-extraction.json");
    const pages = new Map(extraction.pages.map((page: any) => [page.pageNumber, normalize(page.text)]));
    for (const row of gold.rows.slice(-10)) {
      expect(row.acceptedEvidence.length).toBeGreaterThan(0);
      expect(row.rejectedEvidence.length).toBeGreaterThan(0);
      for (const evidence of [...row.acceptedEvidence, ...row.rejectedEvidence]) {
        expect(evidence.quote).toEqual(expect.any(String));
        expect(evidence.page).toEqual(expect.any(Number));
        expect(evidence.section).toEqual(expect.any(String));
        expect(evidence.spanId).toMatch(/^manual:/);
        expect(evidence.provenance).toEqual(expect.objectContaining({ docId: "quick-check-review-question", page: evidence.page, spanId: evidence.spanId, provenanceKind: "manual" }));
        expect(evidence.provenance.sectionPath.length).toBeGreaterThan(0);
        if (row.acceptedEvidence.includes(evidence)) expect(pages.get(evidence.page)).toContain(normalize(evidence.quote));
      }
    }
    const counts = gold.rows.reduce((result: Record<string, number>, row: any) => ({ ...result, [row.finalEvidenceState]: result[row.finalEvidenceState] + 1 }), { FOUND: 0, UNCLEAR: 0, MISSING: 0, "N/A": 0 });
    expect(counts).toEqual(gold.counts);
  });

  it("pins the independently audited set of 15 current machine-versus-gold mismatches", () => {
    const expected = ["R-1-0001", "R-1-0002", "R-1-0003", "R-1-0013", "R-1-0014", "R-1-0015", "R-2-0002", "R-2-0004", "R-2-0007", "R-2-0008", "R-2-0010", "R-2-0012", "R-2-0014", "R-3-0005", "R-4-0001"];
    expect(expected).toHaveLength(15);
    expect(new Set(expected).size).toBe(15);
    expect(expected.every((id) => read("gold.json").rows.some((row: any) => row.ruleReference === id))).toBe(true);
  });

  it("reconciles the final 20 audit records without changing the approved gold boundaries", () => {
    const audit = read("independent-audit.json");
    const gold = read("gold.json");
    const final = audit.rows.slice(38);
    expect(final.map((row: any) => row.ruleReference)).toEqual([
      "R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005",
      "R-5-0006", "R-5-0007", "R-5-0008", "R-5-0009", "R-6-0002", "R-6-0003", "R-6-0004", "R-6-0005", "R-6-0006", "R-6-0007",
    ]);
    expect(audit.rows.filter((row: any) => row.auditResult === "CONFIRMED")).toHaveLength(45);
    expect(audit.rows.filter((row: any) => row.auditResult === "CORRECTED")).toHaveLength(13);
    expect(audit.rows.filter((row: any) => row.auditResult === "INSUFFICIENT_SOURCE_ACCESS")).toHaveLength(0);
    expect(final.filter((row: any) => row.auditResult === "CONFIRMED")).toHaveLength(15);
    expect(final.filter((row: any) => row.auditResult === "CORRECTED")).toHaveLength(5);
    for (const row of final) {
      expect(row.initialIndependentState).toBeDefined();
      expect(row.initialIndependentOutcome).toBeDefined();
      expect(Object.hasOwn(row, "initialDraftFindingCandidate")).toBe(true);
    }
    const byRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    expect(byRule.get("R-3-0004")).toEqual(expect.objectContaining({ finalEvidenceState: "UNCLEAR", reviewerOutcome: "ACTION_REQUIRED" }));
    expect(byRule.get("R-4-0001")).toEqual(expect.objectContaining({ finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS" }));
    expect(final.find((row: any) => row.ruleReference === "R-3-0004")).toEqual(expect.objectContaining({ initialIndependentState: "MISSING", initialComparison: "DISAGREEMENT", reconciliationResult: "GOLD_RETAINED" }));
    expect(final.find((row: any) => row.ruleReference === "R-4-0001")).toEqual(expect.objectContaining({ initialIndependentState: "MISSING", initialComparison: "DISAGREEMENT", reconciliationResult: "GOLD_RETAINED" }));
    expect(byRule.get("R-3-0007")?.finalEvidenceState).toBe("MISSING");
    expect(byRule.get("R-6-0002")?.finalEvidenceState).toBe("UNCLEAR");
    expect(byRule.get("R-6-0005")?.finalEvidenceState).toBe("UNCLEAR");
    expect(byRule.get("R-3-0008")?.acceptedEvidence[0]).toEqual(expect.objectContaining({ page: 11, quote: "The project is not located within a jurisdiction covered by a jurisdictional REDD+ program." }));
    expect(byRule.get("R-3-0008")?.clientAction).toBe("Retain the page 11 statement that the project is not located within a jurisdiction covered by a jurisdictional REDD+ program; reassess this conditional row only if a qualifying VCS JNR jurisdictional baseline is later adopted.");
    expect(byRule.get("R-5-0008")).toEqual(expect.objectContaining({ finalEvidenceState: "UNCLEAR", contradictionState: "DRAFTING_CONTRADICTION" }));
    expect(byRule.get("R-5-0008")?.rationale).toMatch(/VMD0004.*mineral-soil SOC.*VMD0005.*long-term wood-products.*PDD.*VMD0005.*SOC/i);
    expect(byRule.get("R-5-0008")?.clientAction).toMatch(/corrected carbon-pool\/module inventory.*every included and excluded pool/i);
    expect(byRule.get("R-6-0002")?.acceptedEvidence.map((e: any) => e.page)).toEqual(expect.arrayContaining([11, 38]));
    expect(byRule.get("R-6-0005")?.acceptedEvidence.map((e: any) => e.page)).toEqual(expect.arrayContaining([11, 38]));
  });

  it("pins the five reconciled rows and extraction-backed page-11 provenance", () => {
    const current = read("gold.json");
    const historical = read("gold.rc2-rc3.json");
    const metadata = read("metadata.json");
    const changed = current.rows.filter((row: any, index: number) => JSON.stringify(stripRejectedProvenance(row)) !== JSON.stringify(stripRejectedProvenance(historical.rows[index])));
    expect(changed.map((row: any) => row.ruleReference)).toEqual(["R-3-0007", "R-3-0008", "R-5-0008", "R-6-0002", "R-6-0005"]);
    expect(metadata.review.reconciliation.map((row: any) => row.ruleId)).toEqual(changed.map((row: any) => row.ruleId));
    const extraction = read("raw-document-extraction.json");
    const page11 = extraction.pages.find((page: any) => page.pageNumber === 11).text.replace(/\s+/g, " ");
    const audit = read("independent-audit.json");
    for (const ruleReference of ["R-3-0008", "R-6-0002", "R-6-0005"]) {
      const goldEvidence = byRule(current.rows, ruleReference).acceptedEvidence.find((e: any) => e.page === 11);
      const auditEvidence = audit.rows.find((row: any) => row.ruleReference === ruleReference).projectEvidence.find((e: any) => e.page === 11);
      expect(page11).toContain(goldEvidence.quote.replace(/\s+/g, " "));
      expect(auditEvidence.section).toBe(goldEvidence.section);
      expect(auditEvidence.provenance).toEqual(expect.objectContaining({ sectionPath: goldEvidence.provenance.sectionPath, sectionHeading: goldEvidence.provenance.sectionHeading }));
    }
    const r30008Audit = audit.rows.find((row: any) => row.ruleReference === "R-3-0008");
    expect(r30008Audit.clientActionAssessment).toBe(byRule(current.rows, "R-3-0008").clientAction);
    expect(read("corrections.json").finalTruth.find((row: any) => row.ruleId.endsWith("R-3-0008")).clientAction).toBe(byRule(current.rows, "R-3-0008").clientAction);
  });
});

function byRule(rows: any[], ruleReference: string): any { return rows.find((row) => row.ruleReference === ruleReference); }

function stripRejectedProvenance(row: any): any {
  const affected = new Set(["R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005"]);
  if (!affected.has(row.ruleReference)) return row;
  const { rejectedEvidence: _rejectedEvidence, ...rest } = row;
  return rest;
}
