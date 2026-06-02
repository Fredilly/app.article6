/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const createAndStoreEvidenceAttachmentMock = jest.fn();

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

jest.mock("@/lib/chat/quickCheckPdfClient", () => ({
  resolveQuickCheckPdfText: async ({ filename }: { filename: string }) => ({
    text:
      filename === "fresh-monitoring-report.pdf"
        ? "Monitoring report for the full reporting period. Reporting period: 1 January 2025 to 31 December 2025. AR-ACM0003 methodology reference."
        : "",
    engine: "pdf-parse" as const,
    methodologyMentions: filename === "fresh-monitoring-report.pdf" ? ["AR-ACM0003"] : [],
  }),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel upload regression", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  async function uploadEvidence(file: File) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function flushUi() {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function clickButton(label: string) {
    const normalizedLabel = label.toLowerCase();
    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.toLowerCase().includes(normalizedLabel),
    );
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();

    createAndStoreEvidenceAttachmentMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockImplementation(async (input: { pin_id: string; file: File }) => {
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      const attachment = {
        id: `att-${input.pin_id}`,
        pin_id: input.pin_id,
        filename: input.file.name,
        mime: input.file.type || "application/pdf",
        size: bytes.byteLength,
        sha256: `sha-${input.pin_id}`,
        created_at: "2026-04-04T00:00:00Z",
      };
      await putAttachmentBytes(attachment.id, asArrayBuffer(bytes));
      return { ok: true, attachment };
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [{ code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/quick-check/pdf-extract")) {
        const headers = new Headers(init?.headers);
        const encodedFilename = headers.get("x-article6-filename") ?? "";
        const filename = decodeURIComponent(encodedFilename);
        return new Response(
          JSON.stringify({
            text:
              filename === "fresh-monitoring-report.pdf"
                ? "Monitoring report for the full reporting period. Reporting period: 1 January 2025 to 31 December 2025. AR-ACM0003 methodology reference."
                : "",
            engine: "pdf-parse",
            metadata: {
              parser: "pdf-parse",
            },
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
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/query?text=")) {
        return new Response(
          JSON.stringify({
            engineTag: "test",
            metrics: [],
            results: [],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-stale-recovery",
          claimText: "unsupported claim",
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
            filename: "opaque-scan.pdf",
            mime: "application/pdf",
            createdAt: "2026-04-04T00:00:00Z",
            attachment: {
              id: "att-upload-1",
              pin_id: "upload-1",
              filename: "opaque-scan.pdf",
              mime: "application/pdf",
              size: 128,
              sha256: "sha-upload-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          },
        ],
      }),
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

  it("clears stale recovery UI as soon as a new upload replaces the prior evidence", async () => {
    await putAttachmentBytes("att-upload-1", asArrayBuffer(new TextEncoder().encode("%%%%")));

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    expect(container.textContent).toContain("Weak extraction");

    await uploadEvidence(
      new File(
        ["%PDF-1.4\n(Monitoring report for the full reporting period. Reporting period: 1 January 2025 to 31 December 2025. AR-ACM0003 methodology reference.)\n%%EOF"],
        "fresh-monitoring-report.pdf",
        { type: "application/pdf" },
      ),
    );

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("fresh-monitoring-report.pdf");
    expect(text).toContain("Extraction preview");
    expect(text).not.toContain("Weak extraction");
    expect(text).toContain("What the file appears to contain");
    expect(text).toContain("File summary");
    expect(text).toContain("View extraction details");
    expect(text).toContain("Confidence");
    expect(text).not.toContain("Source");
    expect(text).not.toContain("Document Q&A");
    expect(text).not.toContain("raw text: unavailable");
  });
});
