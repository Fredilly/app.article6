import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import PreValidationReadinessPreviewPage from "@/app/internal/reports/pre-validation-readiness/page";

describe("/internal/reports/pre-validation-readiness page", () => {
  test("renders the selected blocked fixture-backed reviewer state", async () => {
    const element = await PreValidationReadinessPreviewPage({ searchParams: Promise.resolve({ state: "blocked" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Internal fixture-backed preview");
    expect(html).toContain("Pre-Validation Readiness Report");
    expect(html).toContain(">blocked<");
    expect(html).toContain("Internal fixture-backed preview");
    expect(html).toContain("reviewer-actions-preview-row-1");
    expect(html).toContain("Approve");
    expect(html).toContain("Edit");
    expect(html).not.toContain("Release to client");
  });
});
