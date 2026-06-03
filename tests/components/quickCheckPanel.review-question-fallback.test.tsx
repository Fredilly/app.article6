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

const NO_METHOD_MONITORING_TEXT = ([
  "Project Design Document",
  "1.0 Executive Summary",
  "This project restores degraded land.",
  "4.3 Monitoring Approach",
  "Monitoring procedures describe annual plot measurements, QA/QC review, calibration logs, and data management checks.",
  "3 Project Description",
  "Project boundaries are clearly defined in the boundary description.",
  "2.4 Baseline Scenario",
  "Baseline conditions are described using historical land use.",
]).join("\n");

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
      let text = PDF_TEXT_BY_FILENAME[filename] ?? "";
      if (!text && /no-method|unknown-meth|foo/i.test(filename)) {
        text = NO_METHOD_MONITORING_TEXT;
      }
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
      if (url.includes("/api/methods/") && url.includes("/rules")) {
        const u = url.toLowerCase();
        if (u.includes("acm")) {
          return new Response(JSON.stringify({
            rules: [
              { id: "ACM-MON-01", title: "ACM0010 monitoring requirements", snippet: "monitoring of emissions and parameters" },
            ],
          }), { status: 200 });
        }
        if (u.includes("vm0007") || u.includes("v1-0")) {
          return new Response(JSON.stringify({
            rules: [
              { id: "M-4.3", title: "Monitoring plan and procedures", snippet: "annual plot measurements, QA/QC, data management for monitoring approach" },
              { id: "M-5.0", title: "Other VM monitoring", snippet: "sampling" },
            ],
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rules: [] }), { status: 200 });
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

  it("selected methodology + monitoring question + monitoring headings => methodology lane returns monitoring candidate, not generic fallback", async () => {
    seedSession({
      claimText: "Does the project describe monitoring procedures?",
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
    // Must not use the old always-generic fallback
    expect(text).not.toContain("No specific methodology rule was confidently applied for this review area.");
    // With selected + monitoring signals + rules provided, should surface candidate and non-generic state
    expect(text).toMatch(/Possible methodology rules found, review manually|M-4\.3|weak mapping|needs review/);
    expect(text).toContain("Methodology lane");
    // Candidate from rules should appear (enriched)
    expect(text).toContain("M-4.3");
  });

  it("VM0007 selected produces its own monitoring rule candidates (different selected yields different set)", async () => {
    seedSession({
      claimText: "Does the project describe monitoring procedures?",
      filename: "document-qa-messy.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "v1-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["document-qa-messy.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();
    await act(async () => { clickButton("Run quick check"); });
    await flushUntilText("M-4.3");

    const text = container.textContent ?? "";
    expect(text).toContain("M-4.3");
    expect(text).not.toContain("ACM-MON-01");
  });

  it("ACM0010 selected produces its own monitoring rule candidates (demonstrates selected changes the candidate rule set)", async () => {
    // Use no-method text (no "VM0007" mention) so detection is not confident-VM; selected ACM will be used without triggering mismatch pause.
    seedSession({
      claimText: "Does the project describe monitoring procedures?",
      filename: "no-method-monitoring.pdf",
      methodologyId: "ACM0010",
      methodologyVersion: "v01-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${NO_METHOD_MONITORING_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();
    await act(async () => { clickButton("Run quick check"); });
    await flushUntilText("Document Q&A");
    await flushUntilText("Possible methodology rules found");

    const text = container.textContent ?? "";
    expect(text).toContain("ACM-MON-01");
    expect(text).not.toContain("M-4.3");
  });

  it("unknown selected methodology => neutral warning, not fake rule mapping", async () => {
    seedSession({
      claimText: "Does the project describe monitoring procedures?",
      filename: "no-method-monitoring.pdf",
      methodologyId: "FOO-999",
      methodologyVersion: "x1",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${NO_METHOD_MONITORING_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUntilText("Document Q&A");

    const text = container.textContent ?? "";
    // Neutral warning for unknown, not a fake mapping or generic rule claim
    expect(text).toMatch(/no available rule definitions|no rule definitions available|neutral fallback/i);
    // Should not pretend a rule was mapped or use old generic
    expect(text).not.toContain("No specific methodology rule was confidently applied");
    expect(text).not.toContain("M-4.3");
    expect(text).not.toContain("ACM-MON-01");
  });

  it("document evidence found but no rule candidate => explicit “no matching rule found,” not mismatch/pause language", async () => {
    // Use VM but a question whose area has no matching rule in the mocked rules for this test
    // (the provided rules are monitoring focused; use a general/unknown area question that still finds doc evidence)
    seedSession({
      claimText: "Does the document address an unrelated exotic topic with no rule?",
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
    expect(text).toContain("No matching rule was found in the selected methodology.");
    // Must not leak mismatch/pause language from old flows
    expect(text).not.toContain("Methodology review paused");
    expect(text).not.toContain("does not match the uploaded document");
    expect(text).not.toContain("No specific methodology rule was confidently applied for this review area.");
  });
});
