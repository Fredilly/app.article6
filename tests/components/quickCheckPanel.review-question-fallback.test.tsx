/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const createAndStoreEvidenceAttachmentMock = jest.fn();

const PDF_TEXT_BY_FILENAME: Record<string, string> = {
  "flat-leakage.pdf": "The project assesses leakage risk from activity shifting each year. Leakage mitigation measures are documented for the project area.",
  "flat-monitoring.pdf": "The monitoring plan describes annual plot measurements and QA procedures. Monitoring records are reviewed each reporting period.",
};

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

jest.mock("@/lib/chat/quickCheckPdfClient", () => {
  const { extractMethodologyMentions } = jest.requireActual("@/lib/chat/quickCheckEvidence") as {
    extractMethodologyMentions: (text: string) => string[];
  };
  return {
    resolveQuickCheckPdfText: async ({ filename }: { filename: string }) => {
      const text = PDF_TEXT_BY_FILENAME[filename] ?? "";
      return {
        text,
        engine: "pdf-parse" as const,
        methodologyMentions: extractMethodologyMentions(text),
      };
    },
  };
});

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel review-question fallback", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let semanticMode: "disabled" | "failed";

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  async function seedAttachmentText(attachmentId: string, text: string) {
    await putAttachmentBytes(attachmentId, asArrayBuffer(new TextEncoder().encode(text)));
  }

  function seedSession(input: { claimText: string; filename: string; attachmentId?: string }) {
    const attachmentId = input.attachmentId ?? "att-upload-1";
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-review-fallback",
          claimText: input.claimText,
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
            filename: input.filename,
            mime: "application/pdf",
            createdAt: "2026-04-04T00:00:00Z",
            attachment: {
              id: attachmentId,
              pin_id: "upload-1",
              filename: input.filename,
              mime: "application/pdf",
              size: 256,
              sha256: `sha-${attachmentId}`,
              created_at: "2026-04-04T00:00:00Z",
            },
          },
        ],
      }),
    );
  }

  async function flushUi() {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  async function flushUntilText(text: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await flushUi();
      if ((container.textContent ?? "").includes(text)) return;
    }
    throw new Error(`Timed out waiting for text: ${text}`);
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.toLowerCase().includes(label.toLowerCase()),
    );
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  beforeEach(() => {
    semanticMode = "disabled";
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

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(JSON.stringify({ methods: [{ code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] }] }), { status: 200 });
      }
      if (url.includes("/api/quick-check/semantic-evidence")) {
        if (semanticMode === "failed") {
          return new Response("upstream error", { status: 500 });
        }
        return new Response(JSON.stringify({
          status: "disabled",
          candidates: [],
          warning: "HF_API_KEY is not configured; semantic evidence suggestions are disabled.",
        }), { status: 200 });
      }
      if (url.includes("/api/query?text=")) {
        return new Response(JSON.stringify({ engineTag: "test", metrics: [], results: [] }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows document evidence for a leakage review question even when semantic suggestions are disabled", async () => {
    seedSession({
      claimText: "Does this PDD assess leakage risk?",
      filename: "flat-leakage.pdf",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["flat-leakage.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    expect(text).toContain("No methodology rule matched, but the uploaded document contains relevant evidence");
    expect(text).toContain("The project assesses leakage risk from activity shifting each year");
    expect(text).not.toContain("No valid analysis path");
  });

  it("shows document evidence for a monitoring review question even when the semantic request fails", async () => {
    semanticMode = "failed";
    seedSession({
      claimText: "Does this PDD describe the monitoring plan?",
      filename: "flat-monitoring.pdf",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["flat-monitoring.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    expect(text).toContain("No methodology rule matched, but the uploaded document contains relevant evidence");
    expect(text).toContain("The monitoring plan describes annual plot measurements and QA procedures");
    expect(text).not.toContain("No valid analysis path");
  });
});
