import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const sha256 = (name: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
const stable = (id: string) => "Verra.AFOLU.VM0007.v1-8." + id;
const batchOne = ["R-1-0001", "R-1-0002", "R-1-0004", "R-1-0005", "R-2-0005", "R-2-0007", "R-3-0001", "R-3-0005", "R-6-0001", "R-6-0008"];
const batchTwo = ["R-1-0003", "R-1-0006", "R-1-0007", "R-1-0008", "R-1-0009", "R-1-0010", "R-1-0011", "R-1-0012", "R-1-0013", "R-1-0014"];
const finalEight = ["R-1-0015", "R-2-0001", "R-2-0002", "R-2-0006", "R-2-0008", "R-2-0016", "R-3-0002", "R-3-0006"];
const nextTen = ["R-2-0003", "R-2-0004", "R-2-0009", "R-2-0010", "R-2-0011", "R-2-0012", "R-2-0013", "R-2-0014", "R-2-0015", "R-3-0003"];
const previousIndependentAuditIds = [...batchOne, ...batchTwo];
const independentAuditIds = [...previousIndependentAuditIds, ...finalEight];
const reviewed = [...independentAuditIds, ...nextTen];
const expectedPages: Record<string, Array<number>> = {
  "R-1-0001": [6, 12, 62], "R-1-0002": [62, 63], "R-1-0003": [63], "R-1-0004": [63], "R-1-0005": [62], "R-1-0006": [62], "R-1-0007": [62], "R-1-0008": [62], "R-1-0009": [12], "R-1-0010": [62], "R-1-0011": [62], "R-1-0012": [62],
  "R-2-0005": [18, 19, 37], "R-2-0007": [63], "R-3-0001": [67], "R-3-0005": [61, 63],
  "R-6-0001": [38, 68], "R-6-0008": [66], "R-1-0013": [62], "R-1-0014": [12, 61, 63], "R-1-0015": [63],
  "R-2-0001": [23, 24], "R-2-0002": [22], "R-2-0006": [65], "R-2-0008": [63, 64], "R-2-0016": [62],
  "R-3-0002": [41, 42], "R-3-0006": [12, 61, 62], "R-2-0003": [59], "R-2-0004": [12, 61], "R-2-0009": [12, 62], "R-2-0010": [65, 68], "R-2-0011": [12, 62], "R-2-0012": [64, 65, 68], "R-2-0013": [15, 62], "R-2-0014": [1, 10, 16], "R-2-0015": [12, 62], "R-3-0003": [18, 66]
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
    expect(reviewedRuleIds).toHaveLength(38);
    expect(reviewedRuleIds.slice(0, 10)).toEqual(batchOne.map(stable));
    expect(reviewedRuleIds.slice(10, 20)).toEqual(batchTwo.map(stable));
    expect(reviewedRuleIds.slice(20, 28)).toEqual(finalEight.map(stable));
    expect(reviewedRuleIds.slice(28)).toEqual(nextTen.map(stable));
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review")).toHaveLength(40);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.goldPromotionBlocked).toBe(true);
    expect(gold.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
    expect(gold.rows).toHaveLength(38);
    expect(gold.rows.every((row: any) => reviewedRuleIds.includes(row.ruleId))).toBe(true);
    expect(draft.rows.filter((row: any) => row.reviewState === "pending review").every((row: any) => !gold.rows.some((goldRow: any) => goldRow.ruleId === row.ruleId))).toBe(true);
  });

  it("maps exact reviewed evidence to explicit rule IDs and correct PDF pages", () => {
    const gold = read("gold.json");
    const corrections = read("corrections.json");
    const rawDocument = read("raw-document-extraction.json");
    const acceptedByRule = new Map<string, any[]>();
    for (const entry of corrections.acceptedEvidence) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      acceptedByRule.set(entry.ruleId, [...(acceptedByRule.get(entry.ruleId) ?? []), entry.evidence]);
    }
    const sourcePages = new Map(rawDocument.pages.map((page: any) => [page.pageNumber, page.text]));
    for (const row of gold.rows) {
      const id = row.ruleReference as string;
      const ruleId = stable(id);
      expect(acceptedByRule.has(ruleId)).toBe(true);
      expect(row.acceptedEvidence.length).toBeGreaterThan(0);
      expect(row.acceptedEvidence).toEqual(acceptedByRule.get(ruleId));
      for (const evidence of row.acceptedEvidence) {
        expect(sourcePages.has(evidence.page)).toBe(true);
        expect(normalize(sourcePages.get(evidence.page) ?? "")).toContain(normalize(evidence.quote));
        expect(expectedPages[id]).toContain(evidence.page);
        expect(evidence.provenance.page).toBe(evidence.page);
        expect(evidence.provenance.sectionPath[0]).toBe(evidence.page <= 9 ? "1 SUMMARY OF PROJECT BENEFITS" : evidence.page < 61 ? "2 PROJECT DETAILS" : "3 CLIMATE");
        expect(evidence.provenance.provenanceKind).toBe("manual");
        expect(evidence.provenance.spanId).toMatch(/^manual:/);
        expect(evidence.spanId).toMatch(/^manual:/);
        expect(evidence.quote).not.toContain("…");
      }
    }
    for (const entry of corrections.rejectedEvidence) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      expect(entry.evidence.rejectionReason).toMatch(/stitched or paraphrased quote|generic-text false support/);
    }
    for (const entry of corrections.reviewerCorrections) {
      expect(entry.ruleId).toBeTruthy();
      expect(reviewed).toContain(entry.ruleId.split(".").pop());
      expect(entry.correction.ruleId).toBe(entry.ruleId);
    }
  });

  it("records the cumulative independent audit and the exact batch-two rows", () => {
    const gold = read("gold.json");
    const audit = read("independent-audit.json");
    const rawDocument = read("raw-document-extraction.json");
    const sourcePages = new Map(rawDocument.pages.map((page: any) => [page.pageNumber, page.text]));
    const goldByRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    expect(audit.rows.map((row: any) => row.ruleReference)).toEqual(independentAuditIds);
    expect(new Set(audit.rows.map((row: any) => row.ruleReference)).size).toBe(28);
    expect(sha256("independent-audit.json")).toBe("2f3cb3257fc12d6ec1693bd4606e3f7102d1d9427b672908266595fccead291f");
    expect(audit.rows.slice(20).map((row: any) => row.ruleReference)).toEqual(finalEight);
    expect(audit.rows.slice(10, 20).map((row: any) => row.ruleReference)).toEqual(batchTwo);
    expect(audit.rows.every((row: any) => row.auditResult && row.rationale && row.requirementReviewed && row.pagesInspected.length > 0)).toBe(true);
    expect(audit.rows.filter((row: any) => row.auditResult === "INSUFFICIENT_SOURCE_ACCESS")).toHaveLength(0);
    expect(audit.rows.filter((row: any) => row.auditResult === "CORRECTED").map((row: any) => row.ruleReference)).toEqual(["R-1-0001", "R-1-0002", "R-3-0005", "R-1-0014", "R-2-0001", "R-2-0002", "R-2-0006", "R-3-0002"]);
    expect(crypto.createHash("sha256").update(JSON.stringify(audit.rows.slice(0, 20))).digest("hex")).toBe("3c242daa48c2672bf4e92081710e6910e0482729c1bf13dc16fbd0698a35a155");
    expect(audit.rows.find((row: any) => row.ruleReference === "R-1-0005")).toEqual(expect.objectContaining({ finalState: "N/A", applicabilityReason: expect.any(String) }));
    expect(audit.rows.filter((row: any) => row.finalState === "FOUND").every((row: any) => ["COMPLETE", "COMPLETE_AFTER_CORRECTION"].includes(row.evidenceCompleteness))).toBe(true);
    expect(audit.rows.filter((row: any) => row.finalState === "UNCLEAR").every((row: any) => row.reviewerOutcome === "ACTION_REQUIRED")).toBe(true);
    expect(audit.rows.filter((row: any) => row.multiPartRequirement && row.finalState === "FOUND").every((row: any) => ["COMPLETE", "COMPLETE_AFTER_CORRECTION"].includes(row.evidenceCompleteness))).toBe(true);
    for (const auditRow of audit.rows) {
      const goldRow = goldByRule.get(auditRow.ruleReference)!;
      expect(auditRow.finalState).toBe(goldRow.finalEvidenceState);
      expect(auditRow.reviewerOutcome).toBe(goldRow.reviewerOutcome);
      for (const page of auditRow.pagesInspected) expect(sourcePages.has(page)).toBe(true);
      for (const evidence of auditRow.projectEvidence ?? []) expect(auditRow.pagesInspected).toContain(evidence.page);
      for (const evidence of goldRow.acceptedEvidence) {
        expect(sourcePages.has(evidence.page)).toBe(true);
        expect((sourcePages.get(evidence.page) ?? "").replace(/\s+/g, " ").trim()).toContain(evidence.quote.replace(/\s+/g, " ").trim());
      }
    }
    const batchTwoAudit = audit.rows.filter((row: any) => batchTwo.includes(row.ruleReference));
    expect(batchTwoAudit).toHaveLength(10);
    expect(batchTwoAudit.filter((row: any) => row.auditResult === "CONFIRMED")).toHaveLength(9);
    expect(batchTwoAudit.filter((row: any) => row.auditResult === "CORRECTED")).toHaveLength(1);
    expect(batchTwoAudit.filter((row: any) => row.auditResult === "INSUFFICIENT_SOURCE_ACCESS")).toHaveLength(0);
    for (const row of batchTwoAudit) {
      expect(row.rationale).toMatch(/page/i);
      expect(row.clientActionAssessment).toBeTruthy();
    }
    const correctedBatchTwo = audit.rows.find((row: any) => row.ruleReference === "R-1-0014");
    expect(correctedBatchTwo).toEqual(expect.objectContaining({ finalState: "FOUND", reviewerOutcome: "CONFORMS", auditResult: "CORRECTED", evidenceCompleteness: "COMPLETE" }));
    expect(correctedBatchTwo.methodologyTraceability).toEqual(expect.objectContaining({ methodology: "VM0007 v1.8", section: "4.3.4", methodologyPage: 18 }));
    expect(correctedBatchTwo.methodologyTraceability.officialRequirementQuote).toContain("does not apply to ARR project activities");
    expect(correctedBatchTwo.projectEvidence.map((evidence: any) => evidence.page)).toEqual([12, 61, 63]);
    for (const row of batchTwoAudit.filter((row: any) => row.ruleReference !== "R-1-0014")) {
      expect(row.finalState).toBe("N/A");
      expect(row.reviewerOutcome).toBe("NOT_APPLICABLE");
      expect(row.applicabilityTrigger).toBeTruthy();
      expect(row.applicabilityReason).toBeTruthy();
    }
    const finalAudit = audit.rows.slice(20);
    expect(finalAudit).toHaveLength(8);
    expect(finalAudit.filter((row: any) => row.auditResult === "CONFIRMED")).toHaveLength(4);
    expect(finalAudit.filter((row: any) => row.auditResult === "CORRECTED")).toHaveLength(4);
    expect(finalAudit.filter((row: any) => row.auditResult === "INSUFFICIENT_SOURCE_ACCESS")).toHaveLength(0);
    for (const row of finalAudit) {
      expect(row.methodologyTraceability).toEqual(expect.objectContaining({ methodology: "VM0007 v1.8", version: expect.any(String), section: expect.any(String), methodologyPage: expect.any(Number), officialRequirementQuote: expect.any(String) }));
      expect(row.pagesInspected.length).toBeGreaterThan(0);
      if (row.finalState === "N/A") {
        expect(row.applicabilityTrigger).toBeTruthy();
        expect(row.applicabilityReason).toBeTruthy();
        expect(row.projectEvidence.length).toBeGreaterThan(0);
      }
      if (row.finalState === "FOUND") expect(["COMPLETE", "COMPLETE_AFTER_CORRECTION"]).toContain(row.evidenceCompleteness);
      if (row.finalState === "UNCLEAR") {
        expect(row.reviewerOutcome).toBe("ACTION_REQUIRED");
        expect(row.clientActionAssessment).toMatch(/provide|retain/i);
      }
    }
    const r20002Audit = finalAudit.find((row: any) => row.ruleReference === "R-2-0002")!;
    expect(r20002Audit).toEqual(expect.objectContaining({ finalState: "N/A", reviewerOutcome: "NOT_APPLICABLE", auditResult: "CORRECTED", evidenceCompleteness: "NOT_APPLICABLE" }));
    expect(r20002Audit.applicabilityTrigger).toMatch(/Where multiple baselines exist/);
    expect(r20002Audit.applicabilityReason).toMatch(/Only the APD\/BL-PL/);
    const r20006Audit = finalAudit.find((row: any) => row.ruleReference === "R-2-0006")!;
    expect(r20006Audit.requirementReviewed).toMatch(/stratif|homogeneous|X-STR/i);
    expect(r20006Audit.methodologyTraceability.section).toMatch(/X-STR/);
    expect(r20006Audit.methodologyTraceability.officialRequirementQuote).not.toMatch(/spatial boundaries of a project must be clearly defined/i);
    const r30006Audit = finalAudit.find((row: any) => row.ruleReference === "R-3-0006")!;
    expect(r30006Audit.requirementReviewed).toMatch(/BL-UP|BL-PL|BL-PEAT|BL-TW/);
    expect(r30006Audit.methodologyTraceability.officialRequirementQuote).toMatch(/baseline modules/);
    expect(r30006Audit.methodologyTraceability.officialRequirementQuote).not.toMatch(/lower the water table/i);
    const r30002 = goldByRule.get("R-3-0002")!;
    expect(r30002.clientAction).not.toMatch(/barrier analysis|investment analysis|final baseline selection/i);
    const source = rawDocument.pages.map((page: any) => page.text).join("\n");
    const normalizeAudit = (value: string) => value.replace(/\s+/g, " ").trim();
    const r1 = goldByRule.get("R-1-0001");
    expect(r1.finalEvidenceState).toBe("UNCLEAR");
    expect(r1.reviewerOutcome).toBe("ACTION_REQUIRED");
    expect(r1.draftFindingCandidate).toBe("NIR_CANDIDATE");
    expect(r1.acceptedEvidence.some((e: any) => e.page === 62 && /MapBiomas Collection 10/.test(e.quote) && /PRODES\/INPE/.test(e.quote))).toBe(true);
    expect(r1.acceptedEvidence.some((e: any) => e.page === 6 && /minimum forest area/.test(e.quote) && /tree height/.test(e.quote) && /crown cover/.test(e.quote))).toBe(true);
    expect(r1.finalEvidenceState).not.toBe("FOUND");
    const r3 = goldByRule.get("R-3-0005");
    expect(r3.acceptedEvidence.some((e: any) => e.page === 61 && /VMD0006/.test(e.quote) && /BL- ?PL/.test(e.quote))).toBe(true);
    expect(r3.acceptedEvidence.some((e: any) => e.page === 63 && /VMD0006/.test(e.quote) && /applicable for estimating/.test(e.quote))).toBe(true);
    expect(r3.acceptedEvidence.some((e: any) => e.page === 63 && /planned deforestation \(APD\)/.test(e.quote))).toBe(true);
    for (const id of independentAuditIds) {
      const row = gold.rows.find((candidate: any) => candidate.ruleReference === id)!;
      for (const evidence of row.acceptedEvidence) expect(normalizeAudit(sourcePages.get(evidence.page) ?? "")).toContain(normalizeAudit(evidence.quote));
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
      if (row.draftFindingCandidate === "NCR_CANDIDATE") {
        expect(row.finalEvidenceState).toBe("FOUND");
        expect(row.reviewerOutcome).not.toBe("NOT_ASSESSED");
        expect(row.rationale ?? row.clientAction ?? "").toMatch(/nonconform|prohibit|violate|contradict/i);
      }
    }
    const calculatedCounts = gold.rows.reduce((counts: Record<string, number>, row: any) => {
      counts[row.finalEvidenceState] = (counts[row.finalEvidenceState] ?? 0) + 1;
      return counts;
    }, { FOUND: 0, UNCLEAR: 0, MISSING: 0, "N/A": 0 });
    expect(gold.counts).toEqual(calculatedCounts);
    expect(calculatedCounts).toEqual({ FOUND: 5, UNCLEAR: 16, MISSING: 0, "N/A": 17 });
  });

  it("keeps all 38 reviewed rows and excludes the remaining 20", () => {
    const gold = read("gold.json");
    const byRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    expect(finalEight.every((id) => byRule.has(id))).toBe(true);
    expect(finalEight.map((id) => [id, byRule.get(id)?.finalEvidenceState, byRule.get(id)?.reviewerOutcome])).toEqual([
      ["R-1-0015", "FOUND", "CONFORMS"], ["R-2-0001", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0002", "N/A", "NOT_APPLICABLE"], ["R-2-0006", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0008", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0016", "N/A", "NOT_APPLICABLE"], ["R-3-0002", "UNCLEAR", "ACTION_REQUIRED"], ["R-3-0006", "N/A", "NOT_APPLICABLE"],
    ]);
    expect(gold.rows.some((row: any) => row.ruleReference === "R-4-0001")).toBe(false);
    expect(gold.rows).toHaveLength(38);
    expect(gold.rows.every((row: any) => reviewed.includes(row.ruleReference))).toBe(true);
    expect(nextTen.map((id) => [id, byRule.get(id)?.finalEvidenceState, byRule.get(id)?.reviewerOutcome])).toEqual([
      ["R-2-0003", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0004", "N/A", "NOT_APPLICABLE"],
      ["R-2-0009", "N/A", "NOT_APPLICABLE"], ["R-2-0010", "UNCLEAR", "ACTION_REQUIRED"],
      ["R-2-0011", "N/A", "NOT_APPLICABLE"], ["R-2-0012", "UNCLEAR", "ACTION_REQUIRED"],
      ["R-2-0013", "UNCLEAR", "ACTION_REQUIRED"], ["R-2-0014", "FOUND", "CONFORMS"],
      ["R-2-0015", "N/A", "NOT_APPLICABLE"], ["R-3-0003", "UNCLEAR", "ACTION_REQUIRED"],
    ]);
  });

  it("keeps batch-one outcomes stable and gives the final eight complete provenance", () => {
    const gold = read("gold.json");
    const byRule = new Map(gold.rows.map((row: any) => [row.ruleReference, row]));
    const priorStates: Record<string, string> = {
      "R-1-0001": "UNCLEAR", "R-1-0002": "FOUND", "R-1-0004": "UNCLEAR", "R-1-0005": "N/A",
      "R-2-0005": "UNCLEAR", "R-2-0007": "UNCLEAR", "R-3-0001": "UNCLEAR", "R-3-0005": "FOUND",
      "R-6-0001": "UNCLEAR", "R-6-0008": "UNCLEAR", "R-1-0003": "N/A", "R-1-0006": "N/A",
      "R-1-0007": "N/A", "R-1-0008": "N/A", "R-1-0009": "N/A", "R-1-0010": "N/A",
      "R-1-0011": "N/A", "R-1-0012": "N/A"
    };
    for (const [ruleId, state] of Object.entries(priorStates)) expect(byRule.get(ruleId)?.finalEvidenceState).toBe(state);
    for (const ruleId of finalEight) {
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
    const finalEightStates: Record<string, [string, string]> = {
      "R-1-0015": ["FOUND", "CONFORMS"], "R-2-0001": ["UNCLEAR", "ACTION_REQUIRED"], "R-2-0002": ["N/A", "NOT_APPLICABLE"],
      "R-2-0006": ["UNCLEAR", "ACTION_REQUIRED"], "R-2-0008": ["UNCLEAR", "ACTION_REQUIRED"], "R-2-0016": ["N/A", "NOT_APPLICABLE"],
      "R-3-0002": ["UNCLEAR", "ACTION_REQUIRED"], "R-3-0006": ["N/A", "NOT_APPLICABLE"]
    };
    for (const [ruleId, [state, outcome]] of Object.entries(finalEightStates)) {
      expect(byRule.get(ruleId)?.finalEvidenceState).toBe(state);
      expect(byRule.get(ruleId)?.reviewerOutcome).toBe(outcome);
    }
    expect(byRule.get("R-1-0014")?.finalEvidenceState).toBe("FOUND");
    expect(byRule.get("R-1-0014")?.reviewerOutcome).toBe("CONFORMS");
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
    expect(review).toContain("20, unreviewed and NOT_ASSESSED");
  });
});
