/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const createAndStoreEvidenceAttachmentMock = jest.fn();
const pushMock = jest.fn();

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

// Direct client mock (same pattern as the isolating commit in the original PR).
// This avoids any fetch interception + x-article6-filename header assumptions
// that conflict with the FormData browser upload path.
jest.mock("@/lib/chat/quickCheckPdfClient", () => ({
  resolveQuickCheckPdfText: jest.fn(async ({ filename, bytes }: { filename: string; bytes: ArrayBuffer }) => {
    const text = filename === "fresh-monitoring-report.pdf"
      ? "Monitoring report for the full reporting period. AR-ACM0003 methodology reference."
      : filename === "broken-parser.pdf"
      ? "" // triggers parser-failed path in some flows
      : "";

    if (filename === "oversized.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: `PDF exceeds the Quick Check upload limit of 20MB.`,
        diagnosticCode: "file-too-large" as const,
      };
    }
    if (filename === "invalid-magic.pdf" || filename === "not-a-pdf.txt") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: `Quick Check could not process this upload as a valid PDF.`,
        diagnosticCode: "invalid-file" as const,
      };
    }
    if (filename === "network-failure.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: "Quick Check PDF extraction request failed (service or network issue). Using local fallback (weaker results).",
        diagnosticCode: "upload-request-failed" as const,
      };
    }

    return {
      text,
      engine: "pdf-parse" as const,
      methodologyMentions: text ? ["AR-ACM0003"] : [],
      diagnosticCode: text ? undefined : ("parser-failed" as const),
    };
  }),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel upload error regression (isolated)", () => {
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

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();
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

    // Minimal fetch mock only for methods inventory (no pdf-extract handler, since client is mocked directly).
    (global.fetch as any) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [{ code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] }],
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("surfaces file-too-large diagnostic for oversized PDF (browser FormData path)", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();

    await uploadEvidence(
      new File([new Uint8Array(21 * 1024 * 1024)], "oversized.pdf", { type: "application/pdf" }),
    );
    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("File too large");
    expect(text).toMatch(/20MB|upload limit/i);
  });

  it("surfaces invalid-file diagnostic for bad magic bytes (raw + FormData)", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();

    await uploadEvidence(
      new File([new TextEncoder().encode("NOT A PDF AT ALL")], "invalid-magic.pdf", { type: "application/pdf" }),
    );
    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Invalid PDF upload");
    expect(text).toMatch(/not a valid PDF|could not process/i);
  });

  it("surfaces upload-request-failed diagnostic on network/server extraction failure (prevents silent parser-failed fallback)", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();

    await uploadEvidence(
      new File([new TextEncoder().encode("%PDF-1.4\n(fake for network test)\n%%EOF")], "network-failure.pdf", { type: "application/pdf" }),
    );
    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Upload processing issue");
    expect(text).toMatch(/request.*failed|service or network/i);
    // The key regression guard: we do *not* want a generic "parser failed" or silent weak fallback here.
    expect(text).not.toMatch(/parser failed|PDF parser fallback/i);
  });

  it("keeps raw application/pdf fallback path working for a good PDF", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();

    await uploadEvidence(
      new File(
        [new TextEncoder().encode("%PDF-1.4\n(Monitoring report for the full reporting period. AR-ACM0003 methodology reference.)\n%%EOF")],
        "fresh-monitoring-report.pdf",
        { type: "application/pdf" },
      ),
    );
    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("fresh-monitoring-report.pdf");
    expect(text).toContain("Extraction preview");
  });
});
