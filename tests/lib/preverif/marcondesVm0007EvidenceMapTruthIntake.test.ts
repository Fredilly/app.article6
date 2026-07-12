import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const rawText = fs.readFileSync(path.join(dir, "raw-quick-check-output.txt"), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
const stable = (id: string) => "Verra.AFOLU.VM0007.v1-8." + id;
const reviewed = ["R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008"];
const expectedPages: Record<string, Array<number>> = {
  "R-1-0001": [12], "R-1-0002": [63], "R-1-0004": [63], "R-1-0005": [62],
  "R-2-0005": [18, 19, 37], "R-2-0007": [63], "R-3-0001": [67], "R-3-0005": [63],
  "R-6-0001": [38, 68], "R-6-0008": [66]
};

describe("Marcondes VM0007 v1.8 Evidence Map truth intake", () => {
  it("preserves all raw machine artifacts and keeps review coverage explicit", () => {
    const metadata = read("metadata.json");
    const raw = read("raw-evidence-map.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const gold = read("gold.json");
    const reviewedRuleIds = read("reviewedRuleIds.json").reviewedRuleIds;
    expect(sha256("raw-document-extraction.json")).toBe("7031b49bf70d541679788e65efef09921712a506a0ba4aa2da94b6b754d599");
    expect(sha256("raw-quick-check-output.txt")).toBe("320276d72ea5f9940081fe250ab012a2085ed7e9f978828aa2da94b6b754d599");
    expect(sha256("quick-check-output.json")).toBe("a7f251fa2f2f90ad8f2969963a0f8459fa3124dab9838ba75f8cfae63efe8642");
    expect(sha256("raw-evidence-map.json")).toBe("bd71459647c878855a9ebfe1fe3d6af6e9ec5c8ba89464091bc06ee0dbfe649e");
    expect(raw.results).toHaveLength(58);
    expect(machine.rows).toHaveLength(58);
    expect(draft.rows).toHaveLength(58);
    expect(reviewedRuleIds).toEqual(reviewed.map(stable));
    expect(metadata.review.reviewedRuleIds).toEqual(reviewedRuleIds);
    expect(gold.reviewedRuleIds).toEqual(reviewedRuleIds);
    expect(gold.rows.map((row: any) => row.ruleId)).toEqual(reviewedRuleIds);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review")).toHaveLength(48);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.goldPromotionBlocked).toBe(true);
    expect(gold.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
  });

  it("maps exact reviewed evidence to explicit rule IDs and correct PDF pages", () => {
    const gold = read("gold.json");
    const corrections = read("corrections.json");
    const acceptedByRule = new Map<string, any[]>();
    for (const entry of corrections.acceptedEvidence) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      acceptedByRule.set(entry.ruleId, [...(acceptedByRule.get(entry.ruleId) ?? []), entry.evidence]);
    }
    for (const row of gold.rows) {
      const id = row.ruleReference as string;
      const ruleId = stable(id);
      expect(acceptedByRule.has(ruleId)).toBe(true);
      expect(row.acceptedEvidence.length).toBeGreaterThan(0);
      expect(row.acceptedEvidence).toEqual(acceptedByRule.get(ruleId));
      for (const evidence of row.acceptedEvidence) {
        expect(normalize(rawText)).toContain(normalize(evidence.quote));
        expect(expectedPages[id]).toContain(evidence.page);
        expect(evidence.provenance.page).toBe(evidence.page);
        expect(evidence.provenance.sectionPath[0]).toBe(evidence.page < 61 ? "2 PROJECT DETAILS" : "3 CLIMATE");
        expect(evidence.provenance.provenanceKind).toBe("manual");
        expect(evidence.provenance.spanId).toMatch(/^manual:/);
        expect(evidence.spanId).toMatch(/^manual:/);
        expect(evidence.quote).not.toContain("…");
      }
    }
    for (const entry of corrections.rejectedEvidence) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      expect(entry.evidence.rejectionReason).toContain("stitched or paraphrased quote");
    }
    for (const entry of corrections.reviewerCorrections) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      expect(entry.correction.ruleId).toBe(entry.ruleId);
    }
  });

  it("keeps incomplete mandatory requirements out of CONFORMS and OFI", () => {
    const gold = read("gold.json");
    for (const row of gold.rows) {
      if (row.finalEvidenceState === "UNCLEAR") {
        expect(row.reviewerOutcome).toBe("ACTION_REQUIRED");
        expect(row.draftFindingCandidate).toBe("NIR_CANDIDATE");
        expect(row.reviewerOutcome).not.toBe("CONFORMS");
        expect(row.draftFindingCandidate).not.toBe("OFI_CANDIDATE");
      }
    }
    expect(gold.counts).toEqual({ FOUND: 3, UNCLEAR: 6, MISSING: 0, "N/A": 1 });
  });

  it("records completed version qualification while keeping release blocked", () => {
    const metadata = read("metadata.json");
    const excerpts = read("source-excerpts.json");
    const review = fs.readFileSync(path.join(dir, "REVIEW.md"), "utf8");
    expect(metadata.methodology.reconciled).toBe("VM0007 v1.8");
    expect(metadata.methodology.versionQualified).toBe(true);
    expect(metadata.methodology.reconciliationStatus).toBe("VERSION_QUALIFIED");
    expect(metadata.review.versionReconciliationPending).toBe(false);
    expect(metadata.review.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
    expect(excerpts.methodologyDeclarations).toHaveLength(5);
    expect(review).toContain("VM0007 v1.8 is version-qualified");
    expect(review).toContain("48, unreviewed and NOT_ASSESSED");
  });
});
