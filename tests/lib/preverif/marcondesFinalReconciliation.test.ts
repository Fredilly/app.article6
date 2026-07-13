import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as Record<string, any>;
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

describe("Marcondes finalized Evidence Map reconciliation", () => {
  it("finalizes 58/58 rows, preserves raw machine output, and is report-layer ready", () => {
    const gold = read("gold.json");
    const machine = read("machine-proposal.json");
    const draft = read("gold.draft.json");
    const ids = read("reviewedRuleIds.json").reviewedRuleIds;
    const metadata = read("metadata.json");

    expect(ids).toHaveLength(58);
    expect(new Set(ids).size).toBe(58);
    expect(gold.rows).toHaveLength(58);
    expect(gold.rows.map((row: any) => row.ruleId)).toEqual(ids);
    expect(draft.rows.filter((row: any) => !ids.includes(row.ruleReference))).toHaveLength(0);
    expect(metadata.review.remainingUnreviewedRuleCount).toBe(0);
    expect(metadata.review.releaseReadiness).toEqual(expect.objectContaining({ evidenceMapRows: 58, reviewedRows: 58, unreviewedRows: 0, structurallyReady: true }));
    expect(gold.goldPromotionBlocked).toBe(false);
    expect(gold.reportReleaseState).toBe("READY_FOR_REPORT_RELEASE");
    expect(gold.counts).toEqual({ FOUND: 6, UNCLEAR: 20, MISSING: 10, "N/A": 22 });
    const changedFiles = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    expect(changedFiles.some((file) => /^(src|app|public|components)\//.test(file))).toBe(false);

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
});
