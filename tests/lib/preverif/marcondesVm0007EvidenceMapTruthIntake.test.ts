import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as any;
const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const stable = (id: string) => `Verra.AFOLU.VM0007.v1-8.${id}`;
const first38Hash = "169571058b8d0297b82753d3fc4beb5bd9fcbd71ef7c4e2bbf52d66cfaf11c16";
const auditHash = "4e5a28337341aa5065a9c1a6045a21c3fd314e3a842c3324e3674ed5fbb0cff4";
const nextTen = ["R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005"];

describe("Marcondes VM0007 v1.8 truth intake 39-48", () => {
  it("reviews exactly 48 unique rules and preserves the prior 38", () => {
    const gold = read("gold.json");
    const corrections = read("corrections.json");
    const ids = read("reviewedRuleIds.json").reviewedRuleIds;
    expect(ids).toHaveLength(48);
    expect(new Set(ids).size).toBe(48);
    expect(gold.rows).toHaveLength(48);
    expect(corrections.reviewedRuleIds).toEqual(ids);
    expect(gold.reviewedRuleIds).toEqual(ids);
    expect(hash(gold.rows.slice(0, 38))).toBe(first38Hash);
    expect(ids.slice(0, 38)).toEqual(gold.rows.slice(0, 38).map((row: any) => row.ruleId));
    expect(ids.slice(38)).toEqual(nextTen.map(stable));
    expect(gold.rows.slice(38).map((row: any) => row.ruleReference)).toEqual(nextTen);
    expect(gold.counts).toEqual({ FOUND: 6, UNCLEAR: 19, MISSING: 2, "N/A": 21 });
    expect(gold.goldPromotionBlocked).toBe(true);
    expect(gold.reportReleaseState).toBe("BLOCKED_PENDING_REVIEW_COVERAGE");
  });

  it("uses only complete, page-verifiable evidence and conservative outcomes", () => {
    const gold = read("gold.json");
    const extraction = read("raw-document-extraction.json");
    const pages = new Map(extraction.pages.map((page: any) => [page.pageNumber, normalize(page.text)]));
    for (const row of gold.rows.slice(38)) {
      expect(row.methodologyTraceability).toEqual(expect.objectContaining({ methodology: expect.any(String), version: "v1.8", section: expect.any(String) }));
      expect(row.rationale ?? row.methodologyTraceability.plainLanguageSummary).toEqual(expect.any(String));
      expect(row.applicabilityTrigger).toEqual(expect.any(String));
      expect(row.applicabilityReason).toEqual(expect.any(String));
      for (const evidence of row.acceptedEvidence) {
        expect(pages.has(evidence.page)).toBe(true);
        expect(pages.get(evidence.page)).toContain(normalize(evidence.quote));
        expect(evidence.quote).not.toContain("…");
        expect(evidence.provenance.spanId).toMatch(/^manual:/);
      }
      if (row.finalEvidenceState === "FOUND") expect(row.reviewerOutcome).toBe("CONFORMS");
      if (["UNCLEAR", "MISSING"].includes(row.finalEvidenceState)) {
        expect(row.reviewerOutcome).toBe("ACTION_REQUIRED");
        expect(row.draftFindingCandidate).toBe("NIR_CANDIDATE");
      }
      if (row.finalEvidenceState === "N/A") expect(row.reviewerOutcome).toBe("NOT_APPLICABLE");
    }
  });

  it("keeps the audit independent, all machine rules present, and unreviewed rows unpromoted", () => {
    const audit = read("independent-audit.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const gold = read("gold.json");
    expect(audit.rows).toHaveLength(38);
    expect(hash(audit.rows)).toBe("7104e9cc0ba8f82b42f2f2dfa7c2544af4cca9847ad5e24f4bb47f376d617da7");
    expect(crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, "independent-audit.json"))).digest("hex")).toBe(auditHash);
    expect(machine.rows).toHaveLength(58);
    expect(draft.rows).toHaveLength(58);
    const reviewed = new Set(gold.rows.map((row: any) => row.ruleId));
    const unreviewed = draft.rows.filter((row: any) => !reviewed.has(row.ruleReference));
    expect(unreviewed).toHaveLength(10);
    expect(unreviewed.every((row: any) => row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.rows.slice(38).every((row: any) => row.machineProposal && machine.rows.some((candidate: any) => candidate.ruleReference === row.ruleId && JSON.stringify(candidate) === JSON.stringify(row.machineProposal)))).toBe(true);
  });
});
