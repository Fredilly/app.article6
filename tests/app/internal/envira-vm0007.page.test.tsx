import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import EnviraVm0007FixtureBackedReportPage from "@/app/internal/reports/envira-vm0007/page";

describe("/internal/reports/envira-vm0007 page", () => {
  test("renders a visible Download PDF button for the fixture-backed internal report", () => {
    const html = renderToStaticMarkup(<EnviraVm0007FixtureBackedReportPage />);

    expect(html).toContain("Download PDF");
    expect(html).toContain('href="/api/exports/internal/envira-vm0007-report"');
  });
});
