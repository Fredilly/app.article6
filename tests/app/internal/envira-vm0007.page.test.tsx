import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import EnviraVm0007FixtureBackedReportPage from "@/app/internal/reports/envira-vm0007/page";

describe("/internal/reports/envira-vm0007 page", () => {
  test("renders the blocked legacy mismatch message and blocked PDF download link", () => {
    const html = renderToStaticMarkup(<EnviraVm0007FixtureBackedReportPage />);

    expect(html).toContain("Report blocked");
    expect(html).toContain("Envira VM0007 legacy v1.5 mismatch");
    expect(html).toContain("Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.");
    expect(html).toContain('href="/api/exports/internal/envira-vm0007-report"');
    expect(html).toContain("Download blocked PDF");
    expect(html).not.toContain("Executive Summary");
    expect(html).not.toContain("Evidence Map");
  });
});
