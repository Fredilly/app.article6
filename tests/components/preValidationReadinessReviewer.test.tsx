import { renderToStaticMarkup } from "react-dom/server";
import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import { createReadinessReportViewModel } from "@/lib/evidence/readinessReport";
import { presentationGateFixture } from "../fixtures/presentationGateFixture";

describe("PreValidationReadinessReviewer", () => {
  test("separates accepted and rejected evidence, keeps provenance, and hides release when blocked", () => {
    const html = renderToStaticMarkup(<PreValidationReadinessReviewer report={createReadinessReportViewModel(presentationGateFixture({ blocked: true }))} />);
    expect(html).toContain("blocked");
    expect(html).toContain("Accepted quote");
    expect(html).toContain("Rejected quote");
    expect(html).toContain("Rejected because: Out of scope");
    expect(html).toContain("page 4");
    expect(html).not.toContain("Release to client");
    expect(html).toContain("Draft finding");
  });
});
