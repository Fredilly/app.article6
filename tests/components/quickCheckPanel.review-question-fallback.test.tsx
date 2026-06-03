/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";
import {
  DOCUMENT_QA_MESSY_PDF_TEXT,
  DOCUMENT_QA_NEGATIVE_QUESTION,
  DOCUMENT_QA_REVIEW_QUESTIONS,
} from "../fixtures/quickCheckDocumentQaFixture";

const createAndStoreEvidenceAttachmentMock = jest.fn();

const PDF_TEXT_BY_FILENAME: Record<string, string> = {
  "document-qa-messy.pdf": DOCUMENT_QA_MESSY_PDF_TEXT,
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

const REVIEW_FIELD_CLAIM_STYLE_TEXT = "The boundary description matches the mapped project area.";

describe("QuickCheckPanel review-question fallback", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  async function seedAttachmentText(attachmentId: string, text: string) {
    await putAttachmentBytes(attachmentId, asArrayBuffer(new TextEncoder().encode(text)));
  }

  function seedSession(input: { claimText: string; filename: string; attachmentId?: string; methodologyId?: string; methodologyVersion?: string }) {
    const attachmentId = input.attachmentId ?? "att-upload-1";
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-review-fallback",
          claimText: input.claimText,
          methodologyId: input.methodologyId ?? "",
          methodologyVersion: input.methodologyVersion ?? "",
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
        return new Response(JSON.stringify({
          methods: [
            { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
            { code: "ACM0010", latestVersion: "v01-0", versions: ["v01-0"] },
          ],
        }), { status: 200 });
      }
      if (url.includes("/api/quick-check/semantic-evidence")) {
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

  it("still renders the Document Q&A card when no raw document text is available", async () => {
    seedSession({
      claimText: "Does the document address leakage?",
      filename: "missing-text.pdf",
    });
    await seedAttachmentText("att-upload-1", "%PDF-1.4\n%%EOF");

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();

    // Analyze runs on mount for the seeded (empty-text) upload and sets parse_failed via sync.
    // UI now surfaces explicit document parse status instead of allowing run to fake a review verdict.
    await flushUntilText("Parse failed");

    const text = container.textContent ?? "";
    expect(text).toContain("Parse failed");
    expect(text).toContain("Reprocess document");
    // Guard ensures we do not emit LIKELY/UNCLEAR when parsed text status is not known/good.
    expect(text).not.toContain("unclear");
    // The old unavailable string may appear in diagnostics but not as a review outcome.
  });

  it.each(DOCUMENT_QA_REVIEW_QUESTIONS)("renders the Document Q&A card for document question variant: %s", async (claimText) => {
    seedSession({
      claimText,
      filename: "document-qa-messy.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "v1-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["document-qa-messy.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    expect(text).toContain("Document Q&A");
    expect(text).toContain("route: document_question");
    expect(text).toContain("raw text: available");
    expect(text).toMatch(/likely_yes|likely_no|unclear/);
    expect(text).toContain("recovery suppressed: yes");
    expect(text).not.toContain("No valid analysis path");
    expect(text).not.toContain("No valid analysis path in VM0007");
  });

  it("routes claim-style text entered in the Review question field to Document Q&A instead of methodology fallback", async () => {
    seedSession({
      claimText: REVIEW_FIELD_CLAIM_STYLE_TEXT,
      filename: "document-qa-messy.pdf",
      methodologyId: "ACM0010",
      methodologyVersion: "v01-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["document-qa-messy.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    expect(text).toContain("Document Q&A");
    expect(text).toContain("route: document_question");
    expect(text).toContain("raw text: available");
    expect(text).toContain("recovery suppressed: yes");
    expect(text).not.toContain("No valid analysis path");
    expect(text).not.toContain("No valid analysis path in ACM0010");
  });

  it("keeps Document Q&A primary for a negative document question when raw text exists but no relevant evidence matches", async () => {
    seedSession({
      claimText: DOCUMENT_QA_NEGATIVE_QUESTION,
      filename: "document-qa-messy.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "v1-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["document-qa-messy.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    expect(text).toContain("Document Q&A");
    expect(text).toContain("unclear");
    expect(text).toContain("could not recover useful document-grounded evidence");
    expect(text).toContain("route: document_question");
    expect(text).toContain("raw text: available");
    expect(text).toContain("recovery suppressed: yes");
    expect(text).not.toContain("No valid analysis path");
    expect(text).not.toContain("No valid analysis path in VM0007");
  });
});
