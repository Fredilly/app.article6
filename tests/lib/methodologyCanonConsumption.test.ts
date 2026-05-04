import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";
import { loadManifestEntries } from "@/lib/manifest/cards";

jest.mock("@/lib/manifest/cards", () => ({
  loadManifestEntries: jest.fn(),
}));

const mockedLoadManifestEntries = jest.mocked(loadManifestEntries);

describe("methodology canon consumption", () => {
  beforeEach(() => {
    mockedLoadManifestEntries.mockResolvedValue([
      {
        id: "R-1-0001",
        methodology: "EXAMPLE-METHOD",
        version: "v01-0",
        rule: "Monitoring report must describe the reporting period and supporting evidence.",
        tags: ["monitoring"],
        path: "tests/fixtures/methodology-canon/example-method/v01-0/rules.json",
        sectionId: "S-1",
      },
    ] as never);
  });

  afterEach(() => {
    mockedLoadManifestEntries.mockReset();
  });

  test("loads rich rules from a synced methodology fixture", async () => {
    const result = await loadMethodRules("EXAMPLE-METHOD", "v01-0");

    expect(result.source).toBe("rules.rich.json");
    expect(result.byId.has("TEST.Example.EXAMPLE-METHOD.v01-0.R-1-0001")).toBe(true);
  });

  test("loads rich sections from a synced methodology fixture", async () => {
    const result = await loadMethodSections("EXAMPLE-METHOD", "v01-0");

    expect(result.source).toBe("sections.rich.json");
    expect(result.byId.get("S-1")?.title).toBe("Monitoring requirements");
  });

  test("loads AR-ACM0003 expected evidence from methodology-owned rich rules", async () => {
    mockedLoadManifestEntries.mockResolvedValue([
      {
        id: "R-1-0001",
        methodology: "AR-ACM0003",
        version: "v02-0",
        rule: "Project restores degraded forest lands and meets additionality tests per Tool 01.",
        tags: ["eligibility"],
        path: "public/methodologies/UNFCCC/Forestry/AR-ACM0003/v02-0/rules.json",
        sectionId: "S-1",
      },
    ] as never);

    const result = await loadMethodRules("AR-ACM0003", "v02-0");
    const rule = result.byId.get("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");

    expect(result.source).toBe("rules.rich.json");
    expect(rule?.expectedEvidence).toEqual(["eligibility-proof", "pdd", "gis"]);
  });

  test("does not inject unrelated overrides into other methods", async () => {
    mockedLoadManifestEntries.mockResolvedValue([
      {
        id: "R-1-0001",
        methodology: "EXAMPLE-METHOD",
        version: "v01-0",
        rule: "Monitoring report must describe the reporting period and supporting evidence.",
        tags: ["monitoring"],
        path: "tests/fixtures/methodology-canon/example-method/v01-0/rules.json",
        sectionId: "S-1",
      },
    ] as never);

    const result = await loadMethodRules("EXAMPLE-METHOD", "v01-0");
    const rule = result.byId.get("TEST.Example.EXAMPLE-METHOD.v01-0.R-1-0001");

    expect(rule?.expectedEvidence ?? []).toEqual([]);
  });
});
