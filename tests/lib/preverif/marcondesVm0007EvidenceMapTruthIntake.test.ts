import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;

describe("Marcondes VM0007 v1.8 Evidence Map truth intake", () => {
  it("preserves the complete machine proposal without promoting unreviewed rows", () => {
    const metadata = read("metadata.json");
    const raw = read("raw-evidence-map.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const gold = read("gold.json");
    const states = raw.results.map((row: any) => row.status);

    expect(raw.results).toHaveLength(58);
    expect(machine.rows).toHaveLength(58);
    expect(draft.rows).toHaveLength(58);
    expect(new Set(states)).toEqual(new Set(["supported_by_pdd"]));
    expect(raw.totals).toEqual({ supported_by_pdd: 58, partially_supported: 0, missing_evidence: 0, not_applicable: 0, manual_review_needed: 0 });
    expect(metadata.sourcePdfSha256).toBe("a28e013ddbb4522b93ec954e2f9ca950b5fb906d6ead708e2cc11d829a3e37ea");
    expect(metadata.review.reviewedRuleIds).toEqual([]);
    expect(draft.reviewedRuleIds).toEqual([]);
    expect(draft.rows.every((row: any) => row.reviewState === "pending review" && row.reviewerOutcome === "NOT_ASSESSED" && row.draftFindingCandidate === null)).toBe(true);
    expect(gold.rows).toEqual([]);
    expect(gold.status).toBe("BLOCKED_PENDING_REVIEW");
  });

  it("records every methodology declaration and the visible version reconciliation", () => {
    const metadata = read("metadata.json");
    const excerpts = read("source-excerpts.json");
    const review = fs.readFileSync(path.join(dir, "REVIEW.md"), "utf8");

    expect(metadata.methodology.reconciled).toBe("VM0007 v1.8");
    expect(metadata.methodology.silentNormalization).toBe(false);
    expect(excerpts.methodologyDeclarations).toHaveLength(5);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.page === 61 && item.contradictionState === "DRAFTING_CONTRADICTION" && item.quote.includes("VM0007 v1.7"))).toBe(true);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.table === "Table 30" && item.quote.includes("1.8"))).toBe(true);
    expect(excerpts.methodologyDeclarations.some((item: any) => item.table === "Table 31" && item.quote === "VM0007 v1.8")).toBe(true);
    expect(review).toContain("No silent normalization was applied");
    expect(review).toContain("Gold promotion: BLOCKED");
  });
});
