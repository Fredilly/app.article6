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

  test("exposes typed approve, edit, and reopen callbacks from the centralized workflow actions", () => {
    const calls: string[] = [];
    const report = createReadinessReportViewModel(presentationGateFixture());
    const html = renderToStaticMarkup(<PreValidationReadinessReviewer report={report} workflowState="approved" onEdit={(rowId) => calls.push(`edit:${rowId}`)} onReopen={(rowId) => calls.push(`reopen:${rowId}`)} />);
    expect(html).toContain("Reviewer state: approved");
    expect(html).toContain("Edit");
    expect(html).toContain("Reopen");
    expect(html).not.toContain("Approve");
    expect(calls).toEqual([]);
  });
});
