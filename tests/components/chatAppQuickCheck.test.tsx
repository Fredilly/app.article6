/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const pushMock = jest.fn();
const createAndStoreEvidenceAttachmentMock = jest.fn();
const searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: pushMock, replace: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

const ChatApp = require("@/components/chat/ChatApp").default as typeof import("@/components/chat/ChatApp").default;

describe("ChatApp claim-first landing", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  async function uploadEvidence(file: File) {
    if (typeof file.arrayBuffer !== "function") {
      const fallbackBytes = new TextEncoder().encode(file.name);
      Object.defineProperty(file, "arrayBuffer", {
        configurable: true,
        value: async () => asArrayBuffer(fallbackBytes),
      });
    }
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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
        created_at: "2026-05-27T00:00:00Z",
      };
      await putAttachmentBytes(attachment.id, asArrayBuffer(bytes));
      return { ok: true, attachment };
    });
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
      if (url.includes("/api/quick-check/pdf-extract")) {
        return new Response(
          JSON.stringify({
            pages: [
              {
                pageNumber: 1,
                text: "Project Design Document\nMalawi Demo Project\nMethodology: AR-ACM0003\nStandard: VCS Standard",
              },
            ],
          }),
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
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("renders the quick check intake card and removes chat from the landing page", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    expect(container.textContent).toContain("Quick Check");
    expect(container.textContent).toContain("Assess a carbon project document fast.");
    expect(container.textContent).toContain("Drop your document");
    expect(container.textContent).toContain("Upload document");
    expect(container.textContent).toContain("Try demo check");
    expect(container.textContent).toContain("Run Quick Check");
    expect(container.textContent).toContain("Review question");
    expect(container.querySelectorAll("textarea").length).toBe(1);
    expect(container.textContent).toContain("Options");
    expect(container.textContent).not.toContain("Select saved evidence");
    expect(container.textContent).not.toContain("Ask in chat instead");
    expect(container.textContent).not.toContain("Send");
    expect(container.textContent).not.toContain("Welcome to Article6");
    expect(container.textContent).not.toContain("One claim. One file.");
  });

  it("renders the document-first start review surface when requested", async () => {
    await act(async () => {
      root.render(<ChatApp surface="start-review" />);
    });

    expect(container.textContent).toContain("Drop your document");
    expect(container.textContent).toContain("PDF, DOCX, XLSX, GEOJSON, KML, SHP ZIP");
    expect(container.textContent).toContain("Upload document");
    expect(container.textContent).toContain("Quick Check");
    expect(container.querySelectorAll("textarea").length).toBe(1);
  });

  it("stages document metadata and routes into the handoff when /start-review uploads a file", async () => {
    await act(async () => {
      root.render(<ChatApp surface="start-review" />);
    });

    await uploadEvidence(
      new File(
        ["%PDF-1.4\nMalawi Demo Project\nMethodology: AR-ACM0003\n%%EOF"],
        "fresh-monitoring-report.pdf",
        { type: "application/pdf" },
      ),
    );

    const stagedDraft = window.sessionStorage.getItem("article6:pending-project-document-draft");
    expect(stagedDraft).toContain("fresh-monitoring-report.pdf");
    expect(stagedDraft).toContain("\"origin\":\"quick-check\"");
    expect(pushMock).toHaveBeenCalledWith("/start-review?handoff=document-metadata");
  });
});
