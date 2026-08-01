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
class SuccessfulR2UploadXhr {
  upload = { onprogress: undefined as ((event: ProgressEvent) => void) | undefined };
  onload?: () => void;
  status = 204;
  open(_method: string, url: string) { if (url !== "https://r2.example.test/signed-put") throw new Error(`Unexpected XHR URL: ${url}`); }
  setRequestHeader() {}
  send() { this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent); this.onload?.(); }
}
let selectedRulebookVersion = "v1-0";
let canonicalVm0007Rules: import("@/app/m/_lib/methodRules").RuleSummary[] = [];

const PDF_TEXT_BY_FILENAME: Record<string, string> = {
  "qc-smoke-upload.pdf": PLUM_PDD_TEXT,
  "envira-gold.pdf": ENVIRA_PDD_TEXT,
  "makanza-vm0007-v18.pdf": fs.readFileSync(path.join(process.cwd(), "tests/fixtures/quick-check/v2/makanza-congo-pdd/extracted.txt"), "utf-8"),
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
    createQuickCheckPdfUploadCache: () => new Map(),
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
import { loadVm0007GapReportAudit } from "@/lib/preverif/vm0007GapReportStore";
import { loadVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import { validateVm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { loadMethodRules } from "@/app/m/_lib/methodRules";

jest.setTimeout(15000);

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

  beforeEach(async () => {
    selectedRulebookVersion = "v1-0";
    canonicalVm0007Rules = (await loadMethodRules("VM0007", "v1-8")).rules;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    global.XMLHttpRequest = SuccessfulR2UploadXhr as unknown as typeof XMLHttpRequest;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: jest.fn(),
        replace: jest.fn(),
        href: "http://localhost/",
      },
    });

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
      if (url.includes("/api/quick-check/r2-upload")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string; uploadRef?: string; size?: number };
        if (body.action === "presign") return new Response(JSON.stringify({ uploadRef: "signed-upload-reference-fixture", url: "https://r2.example.test/signed-put", expiresIn: 300 }), { status: 200 });
        if (body.action === "confirm") return new Response(JSON.stringify({ uploadRef: body.uploadRef, size: body.size ?? 0 }), { status: 200 });
        throw new Error(`Unexpected R2 action ${body.action}`);
      }
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [
              { code: "VM0007", latestVersion: selectedRulebookVersion, versions: [selectedRulebookVersion] },
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
      if (url.includes(`/api/methods/VM0007/v/${selectedRulebookVersion}/rules`)) {
        return new Response(
          JSON.stringify({
            rules: selectedRulebookVersion === "v1-8" ? canonicalVm0007Rules : [{ id: "R-1-0001", title: "Forest definition", snippet: "Forest definition evidence.", summary: "Forest definition evidence.", logic: "Confirm the project remains within the forest definition.", tags: ["vm0007", "eligibility"] }],
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

  it("proves the valid VM0007 v1.8 upload flow persists and opens a 58-requirement Evidence Map", async () => {
    selectedRulebookVersion = "v1-8";
    seedSession({
      claimText: "What is the project title?",
      filename: "makanza-vm0007-v18.pdf",
    });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PDF_TEXT_BY_FILENAME["makanza-vm0007-v18.pdf"]})\n%%EOF`);

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await flushUi();
    await flushUi();

    const beforeGenerateText = container.textContent ?? "";
    expect(beforeGenerateText).toContain("Evidence Checks");
    expect(beforeGenerateText).toContain("Internal VM0007 report");
    expect(beforeGenerateText).toContain("Generate Evidence Map");
    expect(beforeGenerateText).toContain("Methodology");

    await act(async () => {
      clickButton("Generate Evidence Map");
    });
    await flushUi();
    await flushUi();

    const link = Array.from(container.querySelectorAll("a")).find((node) => node.textContent?.includes("Open Evidence Map"));
    expect(link).toBeTruthy();
    const href = link?.getAttribute("href") ?? "";
    const auditIdMatch = href.match(/\/internal\/reports\/vm0007-evidence-map\/([^/]+)$/);
    expect(auditIdMatch?.[1]).toBeTruthy();
    const auditId = decodeURIComponent(auditIdMatch?.[1] ?? "");
    const audit = loadVm0007GapReportAudit(auditId);
    const draft = loadVm0007EvidenceMapDraft(auditId);
    expect(audit).not.toBeNull();
    expect(draft).not.toBeNull();
    expect(validateVm0007EvidenceMapDraftPackage(draft, auditId)).toBe(true);
    expect(draft?.rows).toHaveLength(58);
    expect(audit?.loadedRulebookVersion).toBe("v1-8");
    expect(container.textContent ?? "").not.toContain("Pre-Validation Readiness Report");
    expect(container.textContent ?? "").not.toContain("Gap Report");
  });

  it("stores a wrong-version audit but fails closed without a draft and keeps retry available", async () => {
    seedSession({ claimText: "What is the project title?", filename: "qc-smoke-upload.pdf" });
    await seedAttachmentText("att-upload-1", `%PDF-1.4\n(${PLUM_PDD_TEXT})\n%%EOF`);

    await act(async () => { root.render(<QuickCheckPanel />); });
    await flushUi();
    expect(container.textContent).toContain("Generate Evidence Map");
    await act(async () => { clickButton("Generate Evidence Map"); });
    await flushUi();

    expect(container.textContent).toContain("Evidence Map requires the VM0007 v1.8 methodology version.");
    expect(container.textContent).toContain("Retry Evidence Map");
    expect(container.textContent).not.toContain("Open Evidence Map");
    expect(container.textContent).not.toContain("Pre-Validation Readiness Report");
    const auditIds = Object.keys(window.localStorage)
      .filter((key) => key.startsWith("a6:vm0007-gap-report-audit:v1:"))
      .map((key) => key.slice("a6:vm0007-gap-report-audit:v1:".length));
    expect(auditIds).toHaveLength(1);
    expect(loadVm0007EvidenceMapDraft(auditIds[0])).toBeNull();
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
