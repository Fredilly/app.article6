/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Vm0007GapReportLaunchButton from "@/components/preverif/Vm0007GapReportLaunchButton";

describe("VM0007 gap report routing compatibility", () => {
  test("uses the project readiness route for a linked project even without a payload", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/projects/project-1/pre-validation-readiness");
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/projects/project-1/pre-validation-readiness");
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project/a" />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/projects/project%2Fa/pre-validation-readiness");
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" />); });
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/internal/reports/vm0007-gap/audit-1");
    act(() => { root.unmount(); });
  });
});
