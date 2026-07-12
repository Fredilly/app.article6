import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");

describe("Marcondes VM0007 v1.8 Evidence Map truth intake", () => {
  it("preserves raw machine output and promotes only the ten reviewed rows", () => {
    const metadata = read("metadata.json");
    const raw = read("raw-evidence-map.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const gold = read("gold.json");
    const reviewedIds = read("reviewedRuleIds.json").reviewedRuleIds;
    const states = raw.results.map((row: any) => row.status);

    expect(sha256("raw-document-extraction.json")).toBe("7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747");
    expect(sha256("raw-quick-check-output.txt")).toBe("320276d72ea5f9940081fe250ab012a2085ed7e9f978828aa2da94b6b754d599");
    expect(sha256("quick-check-output.json")).toBe("a7f251fa2f2f90ad8f2969963a0f8459fa3124dab9838ba75f8cfae63efe8642");
    expect(sha256("raw-evidence-map.json")).toBe("bd71459647c878855a9ebfe1fe3d6af6e9ec5c8ba89464091bc06ee0dbfe649e");
    expect(raw.results).toHaveLength(58);
    expect(machine.rows).toHaveLength(58);
    expect(draft.rows).toHaveLength(58);
    expect(new Set(states)).toEqual(new Set(["supported_by_pdd"]));
    expect(raw.totals).toEqual({ supported_by_pdd: 58, partially_supported: 0, missing_evidence: 0, not_applicable: 0, manual_review_needed: 0 });
    expect(metadata.sourcePdfSha256).toBe("a28e013ddbb4522b93ec954e2f9ca950b5fb906d6ead708e2cc11d829a3e37ea");
    expect(reviewedIds).toHaveLength(10);
    expect(metadata.review.reviewedRuleIds).toEqual(reviewedIds);
    expect(gold.reviewedRuleIds).toEqual(reviewedIds);
    expect(gold.rows.map((row: any) => row.ruleId)).toEqual(reviewedIds);
    expect(new Set(draft.rows.filter((row: any) => row.reviewState === "reviewed").map((row: any) => row.ruleId))).toEqual(new Set(reviewedIds));
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review")).toHaveLength(48);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.goldPromotionBlocked).toBe(true);
    expect(gold.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
  });

  it("records exact reviewed evidence, rejected machine evidence, and correction reasons", () => {
    const gold = read("gold.json");
    const corrections = read("corrections.json");
    const expectedPages: Record<string, string | number> = { "R-1-0001": 12, "R-1-0002": 63, "R-1-0004": 63, "R-1-0005": 62, "R-2-0005": "18-19", "R-2-0007": 63, "R-3-0001": 66, "R-3-0005": 63, "R-6-0001": 38, "R-6-0008": 66 };
    for (const row of gold.rows) {
      const ruleId = row.ruleReference as string;
      expect(row.acceptedEvidence.quote).not.toContain("…");
      expect(row.acceptedEvidence.quote.length).toBeGreaterThan(50);
      expect(row.acceptedEvidence.page).toBe(expectedPages[ruleId]);
      expect(row.acceptedEvidence.section).toBeTruthy();
      expect(row.acceptedEvidence.provenance.docId).toBe("quick-check-review-question");
      expect(row.acceptedEvidence.provenance.page).toBe(expectedPages[ruleId]);
      expect(row.acceptedEvidence.provenance.sectionPath.length).toBeGreaterThan(0);
      expect(row.acceptedEvidence.provenance.spanId).toBeTruthy();
      expect(row.rejectedEvidence).toHaveLength(1);
      expect(row.rejectedEvidence[0].rejectionReason).toContain("stitched or paraphrased quote");
      expect(row.reviewerCorrection.correction).toBeTruthy();
      expect(row.contradictionState).toBeTruthy();
    }
    expect(corrections.acceptedEvidence).toHaveLength(10);
    expect(corrections.rejectedEvidence).toHaveLength(10);
    expect(corrections.reviewerCorrections).toHaveLength(10);
    expect(gold.rows.find((row: any) => row.ruleReference === "R-1-0005").finalEvidenceState).toBe("N/A");
    expect(gold.rows.find((row: any) => row.ruleReference === "R-6-0008").finalEvidenceState).toBe("UNCLEAR");
  });

  it("records every methodology declaration and a completed but release-blocked reconciliation", () => {
    const metadata = read("metadata.json");
    const excerpts = read("source-excerpts.json");
    const review = fs.readFileSync(path.join(dir, "REVIEW.md"), "utf8");

    expect(metadata.methodology.reconciled).toBe("VM0007 v1.8");
    expect(metadata.methodology.versionQualified).toBe(true);
    expect(metadata.methodology.reconciliationStatus).toBe("VERSION_QUALIFIED");
    expect(metadata.review.versionReconciliationPending).toBe(false);
    expect(metadata.review.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
    expect(metadata.methodology.silentNormalization).toBe(false);
    expect(excerpts.methodologyDeclarations).toHaveLength(5);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.page === 61 && item.contradictionState === "DRAFTING_CONTRADICTION" && item.quote.includes("VM0007 v1.7"))).toBe(true);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.table === "Table 30" && item.quote.includes("1.8"))).toBe(true);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.table === "Table 31" && item.quote === "VM0007 v1.8")).toBe(true);
    expect(review).toContain("VM0007 v1.8 is version-qualified");
    expect(review).toContain("Gold promotion: BLOCKED_PENDING_REVIEW_COVERAGE");
    expect(review).toContain("48, unreviewed and NOT_ASSESSED");
  });
});
