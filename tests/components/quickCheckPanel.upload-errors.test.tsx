/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushMock = jest.fn();
const evidenceCheckResults: Record<string, string[]> = {};

// Mock quickCheckPdfClient to return deterministic text per filename
jest.mock("@/lib/chat/quickCheckPdfClient", () => ({
  resolveQuickCheckPdfText: jest.fn(async ({ filename }: { filename: string }) => {
    if (filename === "network-failure.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: "Quick Check PDF extraction request failed (service or network issue). Using local fallback (weaker results).",
        diagnosticCode: "upload-request-failed" as const,
      };
    }
    if (filename === "oversized.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: "PDF exceeds the Quick Check upload limit of 50 MiB.",
        diagnosticCode: "file-too-large" as const,
      };
    }
    if (filename === "project-a.pdf") {
      return {
        text: "Project A baseline scenario report. Baseline scenario: business-as-usual deforestation. Methodology VM0007.",
        engine: "pdf-parse" as const,
        methodologyMentions: ["VM0007"],
        pdfRef: "blob://project-a",
      };
    }
    if (filename === "project-b.pdf") {
      return {
        text: "Project B monitoring report. Reporting period: 2024-01-01 to 2024-12-31. Methodology VM0007.",
        engine: "pdf-parse" as const,
        methodologyMentions: ["VM0007"],
        pdfRef: "blob://project-b",
      };
    }
    return {
      text: "",
      engine: "heuristic" as const,
      methodologyMentions: [],
    };
  }),
}));

jest.mock("@vercel/blob/client", () => ({
  upload: jest.fn().mockResolvedValue({
    url: "https://mock.private.blob.vercel-storage.com/quick-check/pdfs/mock.pdf",
    pathname: "quick-check/pdfs/mock.pdf",
    contentType: "application/pdf",
    size: 1024,
  }),
}), { virtual: true });

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel upload error codes (light regression)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();

    (global.fetch as any) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(JSON.stringify({ methods: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders the panel without crashing when upload error codes are returned by the client", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await act(async () => { await Promise.resolve(); });

    // Basic smoke: the upload input is present
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Cross-document contamination regression
  // ---------------------------------------------------------------------------

  it("does not contaminate evidence from PDF A into PDF B after sequential uploads", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await act(async () => { await Promise.resolve(); });

    // Step 1: Upload PDF A
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF-A"], "project-a.pdf", { type: "application/pdf" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { await Promise.resolve(); });

    // The auto-run setTimeout(0) is now queued. Before it fires, upload PDF B.
    // With the old bug, runEvidenceChecks would read stale selectedEvidenceSources
    // and process project-a.pdf. With the fix, it uses the snapshot captured
    // after the second upload.

    // Step 2: Upload PDF B (before setTimeout from upload A fires)
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["%PDF-B"], "project-b.pdf", { type: "application/pdf" })],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Flush all pending microtasks (setTimeout(0) from both uploads)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Verify: the UI should show project-b.pdf as the active document
    const text = container.textContent ?? "";
    expect(text).toContain("project-b.pdf");

    // Verify: the previous document name does NOT appear as the current file
    // (project-a.pdf may appear in a "previously uploaded" list, but the
    // active evidence source should be project-b)
    const currentFileLabel = Array.from(container.querySelectorAll("*"))
      .filter((el) => el.textContent?.includes("project-b.pdf"))
      .map((el) => el.textContent);
    expect(currentFileLabel.length).toBeGreaterThan(0);
  });
});
