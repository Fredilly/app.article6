import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as any;
const stable = (id: string) => `Verra.AFOLU.VM0007.v1-8.${id}`;

describe("Marcondes post-998 fixture boundaries", () => {
  it("preserves the source identity and prior reviewed-row slice", () => {
    const metadata = read("metadata.json");
    const ids = read("reviewedRuleIds.json").reviewedRuleIds;
    const gold = read("gold.json");
    expect(metadata.sourcePdfSha256).toBe("a28e013ddbb4522b93ec954e2f9ca950b5fb906d6ead708e2cc11d829a3e37ea");
    expect(metadata.review.reviewedRowCount).toBe(48);
    expect(ids.slice(0, 38)).toEqual(gold.rows.slice(0, 38).map((row: any) => row.ruleId));
    expect(crypto.createHash("sha256").update(JSON.stringify(gold.rows.slice(0, 38))).digest("hex")).toBe("169571058b8d0297b82753d3fc4beb5bd9fcbd71ef7c4e2bbf52d66cfaf11c16");
  });

  it("does not let incomplete truth become supported wording", () => {
    const gold = read("gold.json");
    for (const row of gold.rows.slice(38)) {
      if (["UNCLEAR", "MISSING"].includes(row.finalEvidenceState)) {
        expect(row.reviewerOutcome).toBe("ACTION_REQUIRED");
        expect(row.draftFindingCandidate).toBe("NIR_CANDIDATE");
      }
      if (row.finalEvidenceState === "N/A") {
        expect(row.reviewerOutcome).toBe("NOT_APPLICABLE");
        expect(row.applicabilityTrigger).toBeTruthy();
        expect(row.applicabilityReason).toMatch(/PDD|project|APD|wetland|baseline/i);
      }
      if (row.finalEvidenceState === "FOUND") expect(row.reviewerOutcome).toBe("CONFORMS");
    }
    expect(gold.rows.slice(38).map((row: any) => row.ruleId)).toEqual([
      "R-3-0004", "R-3-0007", "R-3-0008", "R-4-0001", "R-4-0002", "R-5-0001", "R-5-0002", "R-5-0003", "R-5-0004", "R-5-0005",
    ].map(stable));
  });
});
