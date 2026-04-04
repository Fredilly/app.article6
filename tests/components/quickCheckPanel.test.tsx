/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushMock = jest.fn();

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";
import { loadPins } from "@/lib/proofMap/storage";

describe("QuickCheckPanel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();
    (global.fetch as typeof fetch | undefined) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [{ code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/methods/AR-ACM0003/v/v02-0/rules")) {
        return new Response(
          JSON.stringify({
            rules: [
              {
                id: "R-1-0001",
                title: "Monitoring frequency",
                snippet: "Maintain a monitoring report.",
                summary: "Maintain a monitoring report.",
                logic: "Review the report for the reporting period.",
                tags: [],
                expectedEvidence: ["monitoring-report"],
                refs: { primarySection: "S-10", sectionAnchor: "#S-10", tools: ["UNFCCC/TOOL-1"] },
                citations: [{ sectionId: "S-10", label: "Section 10" }],
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    window.localStorage.setItem(
      "pins:AR-ACM0003:v02-0",
      JSON.stringify([
        {
          id: "ev-1",
          kind: "doc",
          title: "Q1 monitoring report",
          cited_ids: [],
          attachments: [
            {
              id: "att-1",
              pin_id: "ev-1",
              filename: "monitoring-report.pdf",
              mime: "application/pdf",
              size: 128,
              sha256: "sha-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          ],
          created_at: "2026-04-04T00:00:00Z",
        },
      ]),
    );
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("blocks execution with clear validation when requirement or evidence is missing", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" onContinueToWorkspace={pushMock} />);
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Check requirement"),
    );
    expect(runButton).toBeTruthy();

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Choose a requirement before running a quick check.");
    expect(container.textContent).toContain("Attach or select at least one evidence item before running a quick check.");
  });

  it("renders a compact result card and hands off into the review workspace", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" onContinueToWorkspace={pushMock} />);
    });

    const requirementSelect = container.querySelectorAll("select")[1] as HTMLSelectElement;
    const inventorySelect = container.querySelectorAll("select")[2] as HTMLSelectElement;
    const addButton = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Add evidence item"),
    );
    const runButton = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Check requirement"),
    );

    await act(async () => {
      requirementSelect.value = "R-1-0001";
      requirementSelect.dispatchEvent(new Event("change", { bubbles: true }));
      inventorySelect.value = "ev-1";
      inventorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("R-1-0001 · Monitoring frequency");
    expect(container.textContent).toContain("Supported");
    expect(container.textContent).toContain("All expected evidence is linked.");
    expect(container.textContent).toContain("Section 10");
    expect(container.textContent).toContain("Continue to Review Workspace");

    const continueButton = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Continue to Review Workspace"),
    );
    await act(async () => {
      continueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith("/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=R-1-0001");
    const storedPins = loadPins("AR-ACM0003", "v02-0");
    expect(storedPins[0]?.ruleId).toBe("R-1-0001");
    expect(window.localStorage.getItem("verify:AR-ACM0003:v02-0")).toContain("R-1-0001");
  });
});
