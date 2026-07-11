/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Vm0007GapReportLaunchButton from "@/components/preverif/Vm0007GapReportLaunchButton";

describe("VM0007 gap report routing compatibility", () => {
  test("uses project readiness route only when the real payload is available", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" readinessPayloadAvailable />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/projects/project-1/pre-validation-readiness");
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" readinessPayloadAvailable={false} />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/internal/reports/vm0007-gap/audit-1");
    act(() => { root.unmount(); });
  });
});
