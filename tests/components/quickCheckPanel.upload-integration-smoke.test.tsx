/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const PLUM_PDD_TEXT = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/quick-check/plum-pdd-regression.txt"),
  "utf-8",
);
const ENVIRA_PDD_TEXT = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/quick-check/v2/envira/extracted.txt"),
  "utf-8",
);
const ENVIRA_GOLD_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/quick-check/v2/envira/gold.json"),
    "utf-8",
  ),
) as Array<{
  checkName: string;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string;
  page: number;
  sectionHeading: string | null;
}>;

const createAndStoreEvidenceAttachmentMock = jest.fn();

const PDF_TEXT_BY_FILENAME: Record<string, string> = {
  "qc-smoke-upload.pdf": PLUM_PDD_TEXT,
  "envira-gold.pdf": ENVIRA_PDD_TEXT,
};

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) =>
    createAndStoreEvidenceAttachmentMock(...args),
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

describe("QuickCheckPanel upload/session boundary smoke test — proves the panel can consume seeded upload/session state; does not test real PDF extraction or parser reliability", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  async function seedAttachmentText(attachmentId: string, text: string) {
    await putAttachmentBytes(attachmentId, asArrayBuffer(new TextEncoder().encode(text)));
  }

  function seedSession(input: {
    claimText: string;
    filename: string;
    attachmentId?: string;
    methodologyId?: string;
    methodologyVersion?: string;
  }) {
    const attachmentId = input.attachmentId ?? "att-upload-1";
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-qc-upload",
          claimText: input.claimText,
          methodologyId: input.methodologyId ?? "",
          methodologyVersion: input.methodologyVersion ?? "",
          evidenceIds: ["upload-1"],
          status: "draft" as const,
          createdAt: "2026-06-10T00:00:00Z",
          updatedAt: "2026-06-10T00:00:00Z",
        },
        result: null,
        stagedUploads: [
          {
            evidenceId: "upload-1",
            filename: input.filename,
            mime: "application/pdf",
            createdAt: "2026-06-10T00:00:00Z",
            attachment: {
              id: attachmentId,
              pin_id: "upload-1",
              filename: input.filename,
              mime: "application/pdf",
              size: 2048,
              sha256: `sha-${attachmentId}`,
              created_at: "2026-06-10T00:00:00Z",
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

  function clickButton(label: string) {
    const normalized = label.toLowerCase();
    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.toLowerCase().includes(normalized),
    );
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();

    delete (window as any).location;
    (window as any).location = {
      assign: jest.fn(),
      replace: jest.fn(),
      href: "http://localhost/",
    };

    createAndStoreEvidenceAttachmentMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockImplementation(
      async (input: { pin_id: string; file: File }) => {
        const bytes = new Uint8Array(await input.file.arrayBuffer());
        const attachment = {
          id: `att-${input.pin_id}`,
          pin_id: input.pin_id,
          filename: input.file.name,
          mime: input.file.type || "application/pdf",
          size: bytes.byteLength,
          sha256: `sha-${input.pin_id}`,
          created_at: "2026-06-10T00:00:00Z",
        };
        await putAttachmentBytes(attachment.id, asArrayBuffer(bytes));
        return { ok: true, attachment };
      },
    );

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [
              { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/quick-check/pdf-extract")) {
        let filename = "document.pdf";
        if (init?.body instanceof FormData) {
          const formFilename = init.body.get("filename");
          if (typeof formFilename === "string" && formFilename.trim()) {
            filename = formFilename;
          }
        } else if (typeof init?.body === "string") {
          const payload = JSON.parse(init.body) as { filename?: string };
          if (payload.filename?.trim()) {
            filename = payload.filename;
          }
        }
        return new Response(
          JSON.stringify({
            text: PDF_TEXT_BY_FILENAME[filename] ?? "",
            engine: "pdf-parse",
            metadata: {
              parser: "pdf-parse",
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/quick-check/semantic-evidence")) {
        return new Response(
          JSON.stringify({
            status: "disabled",
            candidates: [],
            warning: "semantic evidence suggestions disabled in test",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/query?text=")) {
        return new Response(
          JSON.stringify({ engineTag: "test", metrics: [], results: [] }),
          { status: 200 },
        );
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

  it("resolves project-title question from seeded upload/session state", async () => {
    seedSession({
      claimText: "What is the project title?",
      filename: "qc-smoke-upload.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("PLUM Project");
    expect(text).not.toContain("No valid analysis path");
  });

  it("resolves methodology question from seeded upload/session state", async () => {
    seedSession({
      claimText: "What methodology is used for this project?",
      filename: "qc-smoke-upload.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("VM0007");
    expect(text).not.toContain("No valid analysis path");
  });

  it("shows the six Quick Check v2 structured results in the UI preview for Envira", async () => {
    seedSession({
      claimText: "What is the project title?",
      filename: "envira-gold.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "v1-0",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${ENVIRA_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run Checks");
    });
    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Host country");
    expect(text).toContain("Methodology");
    expect(text).toContain("Baseline scenario");
    expect(text).toContain("Additionality");
    expect(text).toContain("Leakage");
    expect(text).toContain("Stakeholder consultation");

    for (const record of ENVIRA_GOLD_FIXTURE) {
      expect(record.expectedStatus).toBe("FOUND");
      expect(text).toContain(record.goldQuote.slice(0, 60));
      expect(text).toContain(`p.${record.page}`);
      if (record.sectionHeading) {
        expect(text).toContain(record.sectionHeading);
      }
    }
  });

  it("shows rejection state for unsupported question from seeded upload/session state", async () => {
    seedSession({
      claimText: "Does the document address marine biodiversity offsets?",
      filename: "qc-smoke-upload.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("unclear");
    expect(text).toContain("could not recover useful document-grounded evidence");
    expect(text).not.toContain("No valid analysis path");
  });

  it("shows rejection state for blue-carbon-mangrove question from seeded upload/session state", async () => {
    seedSession({
      claimText: "What does this document say about blue carbon mangrove restoration?",
      filename: "qc-smoke-upload.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("unclear");
    expect(text).toContain("could not recover");
    expect(text).not.toContain("No valid analysis path");
  });

  it("proves uploaded document text is used (not bypassed) via seeded upload/session state", async () => {
    // Use a distinctive text to prove it's from the uploaded document.
    // plum-pdd-regression has "Without-project Land Use Scenario and Additionality"
    // which is unique to this fixture.
    seedSession({
      claimText: "What is the project title?",
      filename: "qc-smoke-upload.pdf",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();

    // Verify the upload is recognized before running Quick Check
    const textAfterLoad = container.textContent ?? "";
    expect(textAfterLoad).toContain("qc-smoke-upload.pdf");

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    // The uploaded filename should remain visible in the results
    expect(text).toContain("qc-smoke-upload.pdf");
    // No general fallback or missing-document messages
    expect(text).not.toContain("no document text available");
    expect(text).not.toContain("parsed document text was unavailable");
  });
});
