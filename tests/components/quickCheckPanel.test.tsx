/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushMock = jest.fn();
const createAndStoreEvidenceAttachmentMock = jest.fn();

jest.mock("@/lib/proofMap/attachments", () => ({
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";
import { loadPins } from "@/lib/proofMap/storage";

describe("QuickCheckPanel claim-first flow", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockResolvedValue({
      ok: true,
      attachment: {
        id: "att-upload-1",
        pin_id: "upload-1",
        filename: "boundary.pdf",
        mime: "application/pdf",
        size: 256,
        sha256: "sha-upload-1",
        created_at: "2026-04-04T00:00:00Z",
      },
    });

    (global.fetch as typeof fetch | undefined) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [
              { code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] },
              { code: "AR-AMS0007", latestVersion: "v01-0", versions: ["v01-0"] },
            ],
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
              {
                id: "R-1-0002",
                title: "Boundary consistency",
                snippet: "Boundary description aligns to the mapped area.",
                tags: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/methods/AR-AMS0007/v/v01-0/rules")) {
        return new Response(
          JSON.stringify({
            rules: [
              {
                id: "R-2-0001",
                title: "Boundary delineation",
                snippet: "Boundary text is internally consistent.",
                tags: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/query?text=")) {
        const decoded = decodeURIComponent(url.split("text=")[1] ?? "");
        if (decoded.includes("monitoring report")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0001",
                  section_title: "Monitoring frequency",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.91,
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            engineTag: "test",
            metrics: [],
            results: [
              {
                id: "R-1-0002",
                section_title: "Boundary consistency",
                methodology_id: "AR-ACM0003",
                methodology_version: "v02-0",
                score: 0.83,
              },
              {
                id: "R-2-0001",
                section_title: "Boundary delineation",
                methodology_id: "AR-AMS0007",
                methodology_version: "v01-0",
                score: 0.81,
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

  function claimInput(): HTMLTextAreaElement {
    return container.querySelector("textarea") as HTMLTextAreaElement;
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes(label));
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("populates the claim input from a suggested claim chip and keeps upload as the primary evidence action", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    const pageText = container.textContent ?? "";
    expect(pageText).toContain("Upload evidence");
    expect(pageText).toContain("Choose existing evidence");
    expect(pageText.indexOf("Upload evidence")).toBeLessThan(pageText.indexOf("Choose existing evidence"));

    const chip = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("The monitoring report covers the full reporting period."),
    );
    expect(chip).toBeTruthy();

    await act(async () => {
      chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(claimInput().value).toBe("The monitoring report covers the full reporting period.");
  });

  it("shows inline validation when claim or evidence is missing", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("Enter a claim to check.");
    expect(container.textContent).toContain("Upload or select one evidence item.");
  });

  it("renders a compact result card and hands off into the review workspace", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" onContinueToWorkspace={pushMock} />);
    });

    const inventorySelect = container.querySelectorAll("select")[0] as HTMLSelectElement;

    await act(async () => {
      clickButton("The monitoring report covers the full reporting period.");
      inventorySelect.value = "ev-1";
      inventorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      clickButton("Add selected evidence");
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("The monitoring report covers the full reporting period.");
    expect(container.textContent).toContain("R-1-0001 · Monitoring frequency");
    expect(container.textContent).toContain("Supported");
    expect(container.textContent).toContain("All expected evidence is linked.");
    expect(container.textContent).toContain("Section 10");
    expect(container.textContent).toContain("Continue to Review Workspace");

    await act(async () => {
      clickButton("Continue to Review Workspace");
    });

    expect(pushMock).toHaveBeenCalledWith("/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=R-1-0001");
    expect(loadPins("AR-ACM0003", "v02-0")[0]?.ruleId).toBe("R-1-0001");
    expect(window.localStorage.getItem("verify:AR-ACM0003:v02-0")).toContain("R-1-0001");
  });

  it("shows an ambiguous match chooser when the claim maps to multiple likely requirements", async () => {
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-ambiguous",
          claimText: "The boundary description matches the mapped project area.",
          methodologyId: "",
          methodologyVersion: "",
          evidenceIds: ["upload-1"],
          status: "draft",
          createdAt: "2026-04-04T00:00:00Z",
          updatedAt: "2026-04-04T00:00:00Z",
        },
        result: null,
        stagedUploads: [
          {
            evidenceId: "upload-1",
            filename: "boundary.pdf",
            mime: "application/pdf",
            createdAt: "2026-04-04T00:00:00Z",
            attachment: {
              id: "att-upload-1",
              pin_id: "upload-1",
              filename: "boundary.pdf",
              mime: "application/pdf",
              size: 256,
              sha256: "sha-upload-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          },
        ],
      }),
    );

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Likely requirement matches");
    expect(container.textContent).toContain("Multiple likely requirements match this claim.");
    expect(container.textContent).toContain("R-1-0002 · Boundary consistency");
    expect(container.textContent).toContain("R-2-0001 · Boundary delineation");
  });
});
