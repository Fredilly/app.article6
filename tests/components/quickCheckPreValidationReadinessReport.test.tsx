/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import QuickCheckPreValidationReadinessReport from "@/components/projects/QuickCheckPreValidationReadinessReport";

describe("Quick Check Pre-Validation Readiness Report", () => {
  test("renders NOT_ASSESSED without adapting legacy audit data", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<QuickCheckPreValidationReadinessReport auditId="legacy-audit-1" />); });
    expect(container.textContent).toContain("Quick Check source audit: legacy-audit-1");
    expect(container.textContent).toContain("not assessed");
    expect(container.textContent).not.toContain("conformance");
    expect(container.textContent).not.toContain("Draft finding");
    act(() => { root.unmount(); });
  });
});
