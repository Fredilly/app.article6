import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

function buildHtml() {
  return renderToStaticMarkup(<FixtureBackedVm0007ReportView report={buildEnviraVm0007FixtureBackedReport()} />);
}

describe("FixtureBackedVm0007ReportView", () => {
  test("renders the reviewed Envira fixture summary counts and all 58 evidence-map rows", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-evidence-map-row=/g) ?? []).length;

    expect(html).toContain("Internal Envira VM0007 Fixture-Backed Report Preview");
    expect(html).toContain(">FOUND<");
    expect(html).toContain(">30<");
    expect(html).toContain(">UNCLEAR<");
    expect(html).toContain(">8<");
    expect(html).toContain(">MISSING<");
    expect(html).toContain(">3<");
    expect(html).toContain(">N/A<");
    expect(html).toContain(">17<");
    expect(rowCount).toBe(58);
  });

  test("renders UNCLEAR, MISSING, and N/A rows with the required explanations", () => {
    const html = buildHtml();

    expect(html).toContain('data-status="UNCLEAR"');
    expect(html).toContain("still an inference");
    expect(html).toContain("Add the conversion authorization document");

    expect(html).toContain('data-status="MISSING"');
    expect(html).toContain("No accepted quote encoded in fixture truth.");
    expect(html).toContain("Add the project-specific eligibility analysis");

    expect(html).toContain('data-status="N/A"');
    expect(html).toContain("does not apply because the Envira Amazonia Project is a REDD forest-conservation project");
  });

  test("renders rejected evidence examples where the fixture encodes them and avoids banned wording", () => {
    const html = buildHtml();
    const lower = html.toLowerCase();

    expect(html).toContain("the land is legally permitted to be converted to non-forest");
    expect(html).toContain("Generic methodology-applicability language is not the underlying authorization document.");
    expect(html).toContain("Project Description");

    for (const banned of [
      "all clear",
      "fully verified",
      "ready for verification",
      "58 supported",
      "all rules supported",
      "passed",
    ]) {
      expect(lower).not.toContain(banned);
    }
  });
});
