import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const rawText = fs.readFileSync(path.join(dir, "raw-quick-check-output.txt"), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
const stable = (id: string) => "Verra.AFOLU.VM0007.v1-8." + id;
const previousReviewed = ["R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008", "R-1-0003", "R-1-0006", "R-1-0007", "R-1-0008", "R-1-0009", "R-1-0010", "R-1-0011", "R-1-0012"];
const batchReviewed = ["R-1-0013", "R-1-0014", "R-1-0015", "R-2-0001", "R-2-0002", "R-2-0006", "R-2-0008", "R-2-0016", "R-3-0002", "R-3-0006"];
const independentAuditIds = ["R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008"];
const reviewed = [...previousReviewed, ...batchReviewed];
const expectedPages: Record<string, Array<number>> = {
  "R-1-0001": [12], "R-1-0002": [62, 63], "R-1-0003": [63], "R-1-0004": [63], "R-1-0005": [62], "R-1-0006": [62], "R-1-0007": [62], "R-1-0008": [62], "R-1-0009": [12], "R-1-0010": [62], "R-1-0011": [62], "R-1-0012": [62],
  "R-2-0005": [18, 19, 37], "R-2-0007": [63], "R-3-0001": [67], "R-3-0005": [63],
  "R-6-0001": [38, 68], "R-6-0008": [66], "R-1-0013": [62], "R-1-0014": [63], "R-1-0015": [63],
  "R-2-0001": [23, 24], "R-2-0002": [22], "R-2-0006": [65], "R-2-0008": [64], "R-2-0016": [62],
  "R-3-0002": [41, 42], "R-3-0006": [62]
};

describe("Marcondes VM0007 v1.8 Evidence Map truth intake", () => {
  it("preserves all raw machine artifacts and keeps review coverage explicit", () => {
    const metadata = read("metadata.json");
    const raw = read("raw-evidence-map.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const gold = read("gold.json");
    const reviewedRuleIds = read("reviewedRuleIds.json").reviewedRuleIds;
    expect(sha256("raw-document-extraction.json")).toBe("7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747");
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
    expect(reviewedRuleIds).toHaveLength(28);
    expect(reviewedRuleIds.slice(0, 18)).toEqual(previousReviewed.map(stable));
    expect(reviewedRuleIds.slice(18)).toEqual(batchReviewed.map(stable));
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review")).toHaveLength(40);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.goldPromotionBlocked).toBe(true);
    expect(gold.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
    expect(gold.rows).toHaveLength(28);
    expect(gold.rows.every((row: any) => reviewedRuleIds.includes(row.ruleId))).toBe(true);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => !gold.rows.some((goldRow: any) => goldRow.ruleId === row.ruleId))).toBe(true);
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

  it("records an independent audit for exactly the requested ten rows", () => {
    const gold = read("gold.json");
    const audit = read("independent-audit.json");
    expect(audit.rows.map((row: any) => row.ruleReference)).toEqual(independentAuditIds);
    expect(new Set(audit.rows.map((row: any) => row.ruleReference)).size).toBe(10);
    expect(audit.rows.every((row: any) => row.auditResult && row.rationale && row.requirementReviewed && row.pagesInspected.length > 0)).toBe(true);
    expect(audit.rows.filter((row: any) => row.auditResult === "INSUFFICIENT_SOURCE_ACCESS")).toHaveLength(0);
    expect(audit.rows.filter((row: any) => row.auditResult === "CORRECTED").map((row: any) => row.ruleReference)).toEqual(["R-1-0002"]);
    expect(audit.rows.find((row: any) => row.ruleReference === "R-1-0005")).toEqual(expect.objectContaining({ finalState: "N/A", applicabilityReason: expect.any(String) }));
    expect(audit.rows.filter((row: any) => row.finalState === "FOUND").every((row: any) => ["COMPLETE", "COMPLETE_AFTER_CORRECTION"].includes(row.evidenceCompleteness))).toBe(true);
    expect(audit.rows.filter((row: any) => row.finalState === "UNCLEAR").every((row: any) => row.reviewerOutcome === "ACTION_REQUIRED")).toBe(true);
    expect(audit.rows.filter((row: any) => row.multiPartRequirement && row.finalState === "FOUND").every((row: any) => ["COMPLETE", "COMPLETE_AFTER_CORRECTION"].includes(row.evidenceCompleteness))).toBe(true);
    const raw = read("raw-document-extraction.json");
    const source = raw.pages.map((page: any) => page.text).join("\n");
    const normalizeAudit = (value: string) => value.replace(/\s+/g, " ").trim();
    for (const id of independentAuditIds) {
      const row = gold.rows.find((candidate: any) => candidate.ruleReference === id)!;
      for (const evidence of row.acceptedEvidence) expect(normalizeAudit(source)).toContain(normalizeAudit(evidence.quote));
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
    expect(gold.counts).toEqual({ FOUND: 8, UNCLEAR: 7, MISSING: 0, "N/A": 13 });
  });

  it("leaves the other 18 reviewed rows unchanged and excludes the remaining 30", () => {
    const gold = read("gold.json");
    const byRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    const otherReviewed = ["R-1-0003", "R-1-0006", "R-1-0007", "R-1-0008", "R-1-0009", "R-1-0010", "R-1-0011", "R-1-0012", "R-1-0013", "R-1-0014", "R-1-0015", "R-2-0001", "R-2-0002", "R-2-0006", "R-2-0008", "R-2-0016", "R-3-0002", "R-3-0006"];
    expect(otherReviewed.every((id) => byRule.has(id))).toBe(true);
    expect(otherReviewed.map((id) => [id, byRule.get(id)?.finalEvidenceState, byRule.get(id)?.reviewerOutcome])).toEqual([
      ["R-1-0003", "N/A", "NOT_APPLICABLE"], ["R-1-0006", "N/A", "NOT_APPLICABLE"], ["R-1-0007", "N/A", "NOT_APPLICABLE"], ["R-1-0008", "N/A", "NOT_APPLICABLE"], ["R-1-0009", "N/A", "NOT_APPLICABLE"], ["R-1-0010", "N/A", "NOT_APPLICABLE"], ["R-1-0011", "N/A", "NOT_APPLICABLE"], ["R-1-0012", "N/A", "NOT_APPLICABLE"],
      ["R-1-0013", "N/A", "NOT_APPLICABLE"], ["R-1-0014", "N/A", "NOT_APPLICABLE"], ["R-1-0015", "FOUND", "CONFORMS"], ["R-2-0001", "FOUND", "CONFORMS"], ["R-2-0002", "FOUND", "CONFORMS"], ["R-2-0006", "FOUND", "CONFORMS"], ["R-2-0008", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0016", "N/A", "NOT_APPLICABLE"], ["R-3-0002", "FOUND", "CONFORMS"], ["R-3-0006", "N/A", "NOT_APPLICABLE"],
    ]);
    expect(gold.rows.some((row: any) => row.ruleReference === "R-4-0001")).toBe(false);
    expect(gold.rows).toHaveLength(28);
    expect(gold.rows.every((row: any) => independentAuditIds.includes(row.ruleReference) || otherReviewed.includes(row.ruleReference))).toBe(true);
  });

  it("keeps all prior reviewed outcomes stable and gives batch 3 complete provenance", () => {
    const gold = read("gold.json");
    const byRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    const priorStates: Record<string, string> = {
      "R-1-0001": "FOUND", "R-1-0002": "FOUND", "R-1-0004": "UNCLEAR", "R-1-0005": "N/A",
      "R-2-0005": "UNCLEAR", "R-2-0007": "UNCLEAR", "R-3-0001": "UNCLEAR", "R-3-0005": "FOUND",
      "R-6-0001": "UNCLEAR", "R-6-0008": "UNCLEAR", "R-1-0003": "N/A", "R-1-0006": "N/A",
      "R-1-0007": "N/A", "R-1-0008": "N/A", "R-1-0009": "N/A", "R-1-0010": "N/A",
      "R-1-0011": "N/A", "R-1-0012": "N/A"
    };
    for (const [ruleId, state] of Object.entries(priorStates)) expect(byRule.get(ruleId)?.finalEvidenceState).toBe(state);
    for (const ruleId of batchReviewed) {
      const row = byRule.get(ruleId)!;
      expect(row.acceptedEvidence.length).toBeGreaterThan(0);
      expect(row.acceptedEvidence[0].provenance.provenanceKind).toBe("manual");
      expect(row.acceptedEvidence[0].provenance.page).toBe(row.acceptedEvidence[0].page);
      expect(row.acceptedEvidence[0].provenance.sectionPath.length).toBeGreaterThanOrEqual(2);
      expect(row.acceptedEvidence[0].spanId).toMatch(/^manual:/);
      expect(row.rejectedEvidence).toHaveLength(1);
      expect(row.rejectedEvidence[0].rejectionReason).toContain("stitched or paraphrased");
    }
    expect(byRule.get("R-1-0015")?.finalEvidenceState).toBe("FOUND");
    expect(byRule.get("R-1-0015")?.reviewerOutcome).toBe("CONFORMS");
    expect(byRule.get("R-2-0008")?.finalEvidenceState).toBe("UNCLEAR");
    expect(byRule.get("R-2-0008")?.reviewerOutcome).toBe("ACTION_REQUIRED");
    expect(byRule.get("R-2-0001")?.acceptedEvidence.some((evidence: any) => /Fazenda Owner\/Entity/.test(evidence.quote) && /Contr\.\(ha\)/.test(evidence.quote) && /SIGEF/.test(evidence.quote))).toBe(true);
    const scenarioQuotes = byRule.get("R-3-0002")?.acceptedEvidence.map((evidence: any) => evidence.quote).join(" ") ?? "";
    expect(scenarioQuotes).toContain("SCENARIO 1:");
    expect(scenarioQuotes).toContain("SCENARIO 2:");
    expect(scenarioQuotes).toContain("SCENARIO 3:");
    const unchangedBatchOutcomes: Record<string, [string, string]> = {
      "R-1-0013": ["N/A", "NOT_APPLICABLE"], "R-1-0014": ["N/A", "NOT_APPLICABLE"],
      "R-2-0002": ["FOUND", "CONFORMS"], "R-2-0006": ["FOUND", "CONFORMS"],
      "R-2-0008": ["UNCLEAR", "ACTION_REQUIRED"], "R-2-0016": ["N/A", "NOT_APPLICABLE"],
      "R-3-0002": ["FOUND", "CONFORMS"], "R-3-0006": ["N/A", "NOT_APPLICABLE"]
    };
    for (const [ruleId, [state, outcome]] of Object.entries(unchangedBatchOutcomes)) {
      expect(byRule.get(ruleId)?.finalEvidenceState).toBe(state);
      expect(byRule.get(ruleId)?.reviewerOutcome).toBe(outcome);
    }
  });

  it("keeps R-6-0008 on the canonical uncertainty-reduction semantics", () => {
    const gold = read("gold.json");
    const row = gold.rows.find((candidate: any) => candidate.ruleReference === "R-6-0008");
    expect(row.requirement).toBe("Uncertainty reduction requirements");
    expect(row.requirement).not.toBe(
      "Three data source tiers: literature > IPCC defaults > expert opinion."
    );
    expect(row.finalEvidenceState).toBe("UNCLEAR");
    expect(row.reviewerOutcome).toBe("ACTION_REQUIRED");
    expect(row.draftFindingCandidate).toBe("NIR_CANDIDATE");
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
    expect(review).toContain("30, unreviewed and NOT_ASSESSED");
  });
});
