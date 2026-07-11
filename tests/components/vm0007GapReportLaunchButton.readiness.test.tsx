/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Vm0007GapReportLaunchButton from "@/components/preverif/Vm0007GapReportLaunchButton";

describe("VM0007 Evidence Map launch safety", () => {
  test("does not expose readiness or Evidence Map links without a valid persisted draft", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" />); });
    expect(container.querySelector("a")).toBeNull();
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" projectId="project-1" />); });
    expect(container.querySelector("a")).toBeNull();
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit/a" projectId="project/a" />); });
    expect(container.querySelector("a")).toBeNull();
    act(() => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit/a" />); });
    expect(container.querySelector("a")).toBeNull();
    act(() => { root.unmount(); });
  });
});
