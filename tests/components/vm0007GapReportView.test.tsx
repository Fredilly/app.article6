import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { NO_PDD_EVIDENCE_TEXT } from "@/lib/preverif/vm0007GapReport";
import { REPORT_FIXTURE, buildFixtureReport } from "../lib/preverifVm0007ReportFixtures";

function buildHtml() {
  return renderToStaticMarkup(<Vm0007GapReportView report={buildFixtureReport()} />);
}

describe("Vm0007GapReportView", () => {
  test("renders the required VM0007 gap report sections and all 58 rules from fixtures", () => {
    const html = buildHtml();
    const rowCount = (html.match(/data-status=\"/g) ?? []).length;

    expect(html).toContain(REPORT_FIXTURE.expectedReportTitle);
    expect(html).toContain("58 VM0007 rules assessed for validation readiness.");
    for (const heading of REPORT_FIXTURE.expectedSectionOrdering) {
      expect(html).toContain(heading);
    }
    expect(rowCount).toBe(REPORT_FIXTURE.expectedStatusCounts.totalRules);
  });

  test("renders the finalized fixture counts and representative wording", () => {
    const html = buildHtml();

    expect(html).toContain(">30<");
    expect(html).toContain(">8<");
    expect(html).toContain(">3<");
    expect(html).toContain(">17<");
    for (const wording of REPORT_FIXTURE.expectedVisibleWording) {
      expect(html).toContain(wording);
    }
  });

  test("shows supported, weak, missing, and not-applicable states without overstating weak or absent evidence", () => {
    const html = buildHtml();

    expect(html).toContain('data-status="supported"');
    expect(html).toContain('data-status="weak"');
    expect(html).toContain('data-status="missing"');
    expect(html).toContain('data-status="not applicable"');

    expect(html).toContain("Why this was marked supported:");
    expect(html).toContain("Why this was marked not applicable:");
    expect(html).toContain("Why it is weak or missing:");
    expect(html).toContain(NO_PDD_EVIDENCE_TEXT);
    expect(html).toContain("still an inference");
    expect(html).toContain("does not apply because the Envira Amazonia Project is a REDD forest-conservation project");
  });

  test("keeps banned wording and fake pass claims out of the rendered output", () => {
    const html = buildHtml().toLowerCase();

    for (const banned of REPORT_FIXTURE.bannedWording) {
      expect(html).not.toContain(banned.toLowerCase());
    }
    expect(html).not.toContain("100% pass");
  });
});
