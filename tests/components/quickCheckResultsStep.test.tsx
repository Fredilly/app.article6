/** @jest-environment jsdom */

import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const pushMock = jest.fn();
const createAndStoreEvidenceAttachmentMock = jest.fn();
const PDF_TEXT_BY_FILENAME: Record<string, string> = {
  "fresh-monitoring-report.pdf":
    "Monitoring report for the full reporting period. Gold Standard TPDD TEC Version 4.0. AR-ACM0003 methodology reference.",
  "opaque-scan.pdf": "",
  "kenya-second-check-evidence.pdf":
    "Reporting period 1 April 2024 - 31 March 2025. Project area Makueni County and Kitui County. The monitoring report covers the full reporting period.",
};

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) =>
    createAndStoreEvidenceAttachmentMock(...args),
}));

jest.mock("@/lib/chat/quickCheckPdfClient", () => ({
  resolveQuickCheckPdfText: async ({ filename }: { filename: string }) => ({
    text: PDF_TEXT_BY_FILENAME[filename] ?? "",
    engine: "pdf-parse" as const,
  }),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel results step", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes(label),
    );
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function claimInput(): HTMLTextAreaElement {
    return container.querySelector("textarea") as HTMLTextAreaElement;
  }

  function setClaimValue(value: string) {
    const input = claimInput();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
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
          created_at: "2026-04-04T00:00:00Z",
        };
        await putAttachmentBytes(attachment.id, asArrayBuffer(bytes));
        return { ok: true, attachment };
      },
    );

    (global.fetch as typeof fetch | undefined) = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/methods/inventory")) {
          return new Response(
            JSON.stringify({
              methods: [
                { code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] },
                { code: "AR-AM0014", latestVersion: "v03-0", versions: ["v03-0"] },
                { code: "GS-VER1", latestVersion: "v2-0", versions: ["v2-0"] },
                { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
              ],
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
              text: PDF_TEXT_BY_FILENAME[filename] ?? "",
              engine: "pdf-parse",
              metadata: { parser: "pdf-parse" },
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
                {
                  id: "R-1-0003",
                  title: "Monitoring plan",
                  snippet: "Document the monitoring plan for the project.",
                  summary: "Document the monitoring plan for the project.",
                  logic: "Use the PDD and monitoring annexes to confirm the monitoring plan.",
                  tags: ["monitoring", "plan"],
                  expectedEvidence: ["monitoring-report"],
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/methods/AR-AM0014/v/v03-0/rules")) {
          return new Response(JSON.stringify({ rules: [] }), { status: 200 });
        }
        if (url.includes("/api/query?text=")) {
          const decoded = decodeURIComponent(url);
          if (decoded.includes("monitoring report covers the full reporting period")) {
            return new Response(
              JSON.stringify({
                engineTag: "test",
                metrics: [],
                results: [
                  {
                    id: "R-1-0001",
                    methodology_id: "AR-ACM0003",
                    methodology_version: "v02-0",
                    section_title: "Monitoring frequency",
                    text: "Maintain a monitoring report.",
                    tags: [],
                    refs: [],
                  },
                  {
                    id: "R-1-0003",
                    methodology_id: "AR-ACM0003",
                    methodology_version: "v02-0",
                    section_title: "Monitoring plan",
                    text: "Document the monitoring plan for the project.",
                    tags: ["monitoring", "plan"],
                    refs: [],
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
              results: [],
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      },
    ) as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("keeps technical preview details hidden until requested", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      setClaimValue("The monitoring report covers the full reporting period.");
    });

    await uploadEvidence(
      new File(
        ["%PDF-1.4\n(Monitoring report for the full reporting period. AR-ACM0003 methodology reference.)\n%%EOF"],
        "fresh-monitoring-report.pdf",
        { type: "application/pdf" },
      ),
    );

    await flushUi();

    expect(container.textContent).toContain("Extraction preview");
    expect(container.textContent).not.toContain("Source: Uploaded file");
    expect(container.textContent).not.toContain("Use match");

    await act(async () => {
      clickButton("Show details");
    });

    expect(container.textContent).toContain("Source: Uploaded file");
    expect(container.textContent).toContain("Extraction diagnostic");
    expect(container.textContent).toContain("AR-ACM0003");
  });

  it("shows a decision-first useful-signal state before a candidate is chosen", async () => {
    await act(async () => {
      root.render(
        <QuickCheckPanel
          initialMethod="AR-AM0014"
          initialVersion="v03-0"
        />,
      );
    });

    await act(async () => {
      setClaimValue("The monitoring report covers the full reporting period.");
    });

    await uploadEvidence(
      new File(
        ["%PDF-1.4\n(Project area: Makueni County and Kitui County, Kenya.)\n(Reporting period: 1 April 2024 - 31 March 2025.)\n(The monitoring report covers the full reporting period.)\n%%EOF"],
        "kenya-second-check-evidence.pdf",
        { type: "application/pdf" },
      ),
    );

    await flushUi();

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Useful signal, but not enough for a match");
    expect(text).toContain("Document");
    expect(text).toContain("Claim");
    expect(text).toContain("Method");
    expect(text).toContain("AR-AM0014 · v03-0");
    expect(text).toContain("Try another claim");
    expect(text).toContain("Open full review");
    expect(text).toContain("Replace file");
    expect(text).not.toContain("Use match");

    await act(async () => {
      clickButton("Show details");
    });

    expect(container.textContent).toContain("Possible matches");
    expect(container.textContent).toContain("Use match");
  });

  it("promotes a chosen candidate into a preliminary match summary", async () => {
    await act(async () => {
      root.render(
        <QuickCheckPanel
          initialMethod="AR-AM0014"
          initialVersion="v03-0"
          onContinueToWorkspace={pushMock}
        />,
      );
    });

    await act(async () => {
      setClaimValue("The monitoring report covers the full reporting period.");
    });

    await uploadEvidence(
      new File(
        ["%PDF-1.4\n(Project area: Makueni County and Kitui County, Kenya.)\n(Reporting period: 1 April 2024 - 31 March 2025.)\n(The monitoring report covers the full reporting period.)\n%%EOF"],
        "kenya-second-check-evidence.pdf",
        { type: "application/pdf" },
      ),
    );

    await flushUi();

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    await act(async () => {
      clickButton("Show details");
    });

    await flushUi();

    await act(async () => {
      clickButton("Monitoring frequency");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Preliminary match found");
    expect(text).toContain("Matched requirement");
    expect(text).toContain("Monitoring frequency");
    expect(text).toContain("AR-ACM0003 · v02-0");

    await act(async () => {
      clickButton("Open full review");
    });

    expect(pushMock).toHaveBeenCalledWith(
      "/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=R-1-0001&quickCheckSource=uploaded_file",
    );
  });

  it("keeps the selected method visible when the result is only a useful signal", async () => {
    await act(async () => {
      root.render(
        <QuickCheckPanel
          initialMethod="AR-AM0014"
          initialVersion="v03-0"
        />,
      );
    });

    await act(async () => {
      setClaimValue("The monitoring report covers the full reporting period.");
    });

    await uploadEvidence(
      new File(
        ["%PDF-1.4\n(Project area: Makueni County and Kitui County, Kenya.)\n(Reporting period: 1 April 2024 - 31 March 2025.)\n(The monitoring report covers the full reporting period.)\n%%EOF"],
        "kenya-second-check-evidence.pdf",
        { type: "application/pdf" },
      ),
    );

    await flushUi();

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("Useful signal, but not enough for a match");
    expect(text).toContain("AR-AM0014 · v03-0");
    expect(text).toContain("Open full review");
  });

  it("uses the same decision shell for weak extraction failures", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      setClaimValue("The monitoring report covers the full reporting period.");
    });

    await uploadEvidence(
      new File(["%%%%"], "opaque-scan.pdf", { type: "application/pdf" }),
    );

    await flushUi();

    await act(async () => {
      clickButton("Run quick check");
    });

    await flushUi();

    const text = container.textContent ?? "";
    expect(text).toContain("No clear match found");
    expect(text).toContain("Article6 could not extract enough usable text from this file to confirm a match.");
    expect(text).toContain("Try another claim");
    expect(text).toContain("Open full review");
    expect(text).toContain("Replace file");
  });
});
