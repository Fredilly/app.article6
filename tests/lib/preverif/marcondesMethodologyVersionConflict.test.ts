import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as any;

const expectedAffectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-3-0005",
  "Verra.AFOLU.VM0007.v1-8.R-1-0006",
  "Verra.AFOLU.VM0007.v1-8.R-1-0008",
  "Verra.AFOLU.VM0007.v1-8.R-1-0010",
  "Verra.AFOLU.VM0007.v1-8.R-1-0014",
  "Verra.AFOLU.VM0007.v1-8.R-3-0006",
  "Verra.AFOLU.VM0007.v1-8.R-2-0003",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0009",
  "Verra.AFOLU.VM0007.v1-8.R-2-0010",
  "Verra.AFOLU.VM0007.v1-8.R-2-0011",
  "Verra.AFOLU.VM0007.v1-8.R-2-0012",
  "Verra.AFOLU.VM0007.v1-8.R-2-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014",
  "Verra.AFOLU.VM0007.v1-8.R-2-0015",
  "Verra.AFOLU.VM0007.v1-8.R-3-0003",
  "Verra.AFOLU.VM0007.v1-8.R-5-0003",
  "Verra.AFOLU.VM0007.v1-8.R-5-0008",
] as const;

function page61Evidence(row: any): any[] {
  return [...(row.acceptedEvidence ?? []), ...(row.rejectedEvidence ?? [])].filter((evidence) => evidence.page === 61);
}

describe("Marcondes methodology-version conflict regression", () => {
  it("pins the exact affected Evidence Map rows and source declarations", () => {
    const gold = read("gold.json");
    const metadata = read("metadata.json");
    const excerpts = read("source-excerpts.json");

    expect(expectedAffectedRuleIds).toHaveLength(18);
    expect(new Set(expectedAffectedRuleIds).size).toBe(18);
    expect(metadata.methodology.affectedEvidenceMapRuleIds).toEqual(expectedAffectedRuleIds);
    expect(gold.methodologyVersionConflict.affectedReviewedTruthRuleIds).toEqual(expectedAffectedRuleIds);
    expect(metadata.methodology.affectedEvidenceMapRuleIds).toEqual(gold.methodologyVersionConflict.affectedReviewedTruthRuleIds);

    const affected = new Set(expectedAffectedRuleIds);
    for (const ruleId of expectedAffectedRuleIds) {
      const row = gold.rows.find((candidate: any) => candidate.ruleId === ruleId);
      expect(row).toBeDefined();
      expect(page61Evidence(row)).not.toHaveLength(0);
    }
    expect(gold.rows.filter((row: any) => page61Evidence(row).length > 0).map((row: any) => row.ruleId)).toEqual(expectedAffectedRuleIds);
    expect(gold.rows.filter((row: any) => page61Evidence(row).length > 0).every((row: any) => affected.has(row.ruleId))).toBe(true);

    const declarations = new Map(excerpts.methodologyDeclarations.map((declaration: any) => [declaration.provenance.spanId, declaration]));
    expect(declarations.get("manual:page-61:section-3.1.1-v1.7")).toEqual(expect.objectContaining({
      page: 61,
      section: "3.1.1 Title and Reference of Methodology (VCS, 3.1)",
      quote: "As required by VM0007 v1.7, the project area consists of contiguous, discrete areas covered by forest that meet the definition of eligible forest, which would be an area that has been forested for at least 10 years prior to the project start date.",
      provenance: expect.objectContaining({
        page: 61,
        spanId: "manual:page-61:section-3.1.1-v1.7",
        sectionHeading: "3.1.1 Title and Reference of Methodology (VCS, 3.1)",
        sourceType: "PDD",
      }),
    }));
    expect(declarations.get("manual:page-61:table-30-v1.8")).toEqual(expect.objectContaining({
      page: 61,
      section: "Table 30. Methodologies, modules, and tools applied",
      quote: "Applied\nMethodology\nVM0007 REDD+ Methodology Framework (REDD+MF)\n(Avoided Planned Deforestation)\n1.8",
      provenance: expect.objectContaining({
        page: 61,
        spanId: "manual:page-61:table-30-v1.8",
        sectionHeading: "Table 30. Methodologies, modules, and tools applied",
        sourceType: "PDD",
      }),
    }));
    expect(declarations.get("manual:page-61:table-31-v1.8")).toEqual(expect.objectContaining({
      page: 61,
      section: "Table 31. Applicability conditions and justification of conformance",
      quote: "VM0007 v1.8",
      provenance: expect.objectContaining({
        page: 61,
        spanId: "manual:page-61:table-31-v1.8",
        sectionHeading: "Table 31. Applicability conditions and justification of conformance",
        sourceType: "PDD",
      }),
    }));
  });
});
