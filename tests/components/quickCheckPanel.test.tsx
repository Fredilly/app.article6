/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const pushMock = jest.fn();
const createAndStoreEvidenceAttachmentMock = jest.fn();

jest.mock("@/lib/proofMap/attachments", () => ({
  ...jest.requireActual("@/lib/proofMap/attachments"),
  createAndStoreEvidenceAttachment: (...args: unknown[]) => createAndStoreEvidenceAttachmentMock(...args),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";
import { loadPins } from "@/lib/proofMap/storage";

describe("QuickCheckPanel claim-first flow", () => {
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
    methodologyId?: string;
    methodologyVersion?: string;
    evidenceId?: string;
    filename?: string;
    mime?: string;
    attachmentId?: string;
    workbookAsset?: Record<string, unknown>;
  }) {
    const evidenceId = input.evidenceId ?? "upload-1";
    const attachmentId = input.attachmentId ?? "att-upload-1";
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-seeded",
          claimText: input.claimText,
          methodologyId: input.methodologyId ?? "",
          methodologyVersion: input.methodologyVersion ?? "",
          evidenceIds: [evidenceId],
          status: "draft",
          createdAt: "2026-04-04T00:00:00Z",
          updatedAt: "2026-04-04T00:00:00Z",
        },
        result: null,
        stagedUploads: [
          {
            evidenceId,
            filename: input.filename ?? "boundary.pdf",
            mime: input.mime ?? "application/pdf",
            createdAt: "2026-04-04T00:00:00Z",
            attachment: {
              id: attachmentId,
              pin_id: evidenceId,
              filename: input.filename ?? "boundary.pdf",
              mime: input.mime ?? "application/pdf",
              size: 256,
              sha256: `sha-${attachmentId}`,
              created_at: "2026-04-04T00:00:00Z",
              workbook_asset: input.workbookAsset,
            },
          },
        ],
      }),
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockReset();
    createAndStoreEvidenceAttachmentMock.mockResolvedValue({
      ok: true,
      attachment: {
        id: "att-upload-1",
        pin_id: "upload-1",
        filename: "boundary.pdf",
        mime: "application/pdf",
        size: 256,
        sha256: "sha-upload-1",
        created_at: "2026-04-04T00:00:00Z",
      },
    });

    (global.fetch as typeof fetch | undefined) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [
              { code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] },
              { code: "AR-AMS0007", latestVersion: "v01-0", versions: ["v01-0"] },
            ],
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
                refs: { primarySection: "S-10", sectionAnchor: "#S-10", tools: ["UNFCCC/TOOL-1"] },
                citations: [{ sectionId: "S-10", label: "Section 10" }],
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
              {
                id: "R-1-0004",
                title: "Workbook monitoring records",
                snippet: "Maintain workbook-backed monitoring records for the reporting period.",
                summary: "Maintain workbook-backed monitoring records for the reporting period.",
                logic: "Workbook records should identify plots and reporting periods.",
                tags: ["monitoring", "workbook", "plots"],
                expectedEvidence: ["spreadsheet-workbook"],
              },
              {
                id: "R-1-0002",
                title: "Boundary consistency",
                snippet: "Boundary description aligns to the mapped area.",
                tags: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/methods/AR-AMS0007/v/v01-0/rules")) {
        return new Response(
          JSON.stringify({
            rules: [
              {
                id: "R-2-0001",
                title: "Boundary delineation",
                snippet: "Boundary text is internally consistent.",
                tags: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/query?text=")) {
        const decoded = decodeURIComponent(url.split("text=")[1] ?? "");
        const lower = decoded.toLowerCase();
        if (lower.includes("monitoring report")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0001",
                  section_title: "Monitoring frequency",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.91,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("documented monitoring plan")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0003",
                  section_title: "Monitoring plan",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.88,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("project boundary described")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0002",
                  section_title: "Boundary consistency",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.86,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("monitoring data 5 plots")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0004",
                  section_title: "Workbook monitoring records",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.87,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("2026-q1 monitoring records")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0004",
                  section_title: "Workbook monitoring records",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.89,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("documented monitoring evidence")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [
                {
                  id: "R-1-0003",
                  section_title: "Monitoring plan",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.82,
                },
                {
                  id: "R-1-0004",
                  section_title: "Workbook monitoring records",
                  methodology_id: "AR-ACM0003",
                  methodology_version: "v02-0",
                  score: 0.8,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("workbook referenced in pdd")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [],
            }),
            { status: 200 },
          );
        }
        if (lower.includes("unsupported claim")) {
          return new Response(
            JSON.stringify({
              engineTag: "test",
              metrics: [],
              results: [],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            engineTag: "test",
            metrics: [],
            results: [
              {
                id: "R-1-0002",
                section_title: "Boundary consistency",
                methodology_id: "AR-ACM0003",
                methodology_version: "v02-0",
                score: 0.83,
              },
              {
                id: "R-2-0001",
                section_title: "Boundary delineation",
                methodology_id: "AR-AMS0007",
                methodology_version: "v01-0",
                score: 0.81,
              },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    window.localStorage.setItem(
      "pins:AR-ACM0003:v02-0",
      JSON.stringify([
        {
          id: "ev-1",
          kind: "doc",
          title: "Q1 monitoring report",
          cited_ids: [],
          attachments: [
            {
              id: "att-1",
              pin_id: "ev-1",
              filename: "monitoring-report.pdf",
              mime: "application/pdf",
              size: 128,
              sha256: "sha-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          ],
          created_at: "2026-04-04T00:00:00Z",
        },
      ]),
    );
    window.localStorage.setItem(
      "pins:AR-AMS0007:v01-0",
      JSON.stringify([
        {
          id: "ev-ams-1",
          kind: "doc",
          title: "Boundary note",
          cited_ids: [],
          attachments: [
            {
              id: "att-ams-1",
              pin_id: "ev-ams-1",
              filename: "boundary-note.pdf",
              mime: "application/pdf",
              size: 128,
              sha256: "sha-ams-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          ],
          created_at: "2026-04-04T00:00:00Z",
        },
      ]),
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

  function claimInput(): HTMLTextAreaElement {
    return container.querySelector("textarea") as HTMLTextAreaElement;
  }

  function primaryCta(): HTMLButtonElement {
    return Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes("Run quick check")) as HTMLButtonElement;
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find((node) => node.textContent?.includes(label));
    expect(button).toBeTruthy();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("renders a minimal default state with secondary controls collapsed", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    const pageText = container.textContent ?? "";
    expect(pageText).toContain("Check one claim");
    expect(pageText).toContain("Upload evidence");
    expect(pageText).toContain("Use saved evidence instead");
    expect(pageText).toContain("Narrow by methodology");
    expect(pageText).not.toContain("Select saved evidence");
    expect(pageText).not.toContain("MethodologyAny methodology");
    expect(primaryCta().disabled).toBe(true);
  });

  it("populates the claim input from a suggested claim chip and keeps upload as the primary evidence action", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    const chip = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("The monitoring report covers the full reporting period."),
    );
    expect(chip).toBeTruthy();

    await act(async () => {
      chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(claimInput().value).toBe("The monitoring report covers the full reporting period.");
  });

  it("keeps the CTA disabled until claim and evidence are both present", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" />);
    });

    expect(primaryCta().disabled).toBe(true);
  });

  it("enables the CTA only when one claim and one evidence item are present", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" />);
    });

    expect(primaryCta().disabled).toBe(true);

    await act(async () => {
      clickButton("The monitoring report covers the full reporting period.");
    });
    expect(primaryCta().disabled).toBe(true);

    await act(async () => {
      clickButton("Use saved evidence instead");
    });

    const inventorySelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      inventorySelect.value = "ev-1";
      inventorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(primaryCta().disabled).toBe(false);
  });

  it("renders a compact result card and hands off into the review workspace", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-ACM0003" initialVersion="v02-0" onContinueToWorkspace={pushMock} />);
    });

    await act(async () => {
      clickButton("Use saved evidence instead");
    });

    const inventorySelect = container.querySelector("select") as HTMLSelectElement;

    await act(async () => {
      clickButton("The monitoring report covers the full reporting period.");
      inventorySelect.value = "ev-1";
      inventorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("The monitoring report covers the full reporting period.");
    expect(container.textContent).toContain("Methodology");
    expect(container.textContent).toContain("AR-ACM0003 · v02-0");
    expect(container.textContent).toContain("Monitoring frequency");
    expect(container.textContent).toContain("R-1-0001");
    expect(container.textContent).toContain("Supported");
    expect(container.textContent).toContain("All expected evidence is linked.");
    expect(container.textContent).toContain("Section 10");
    expect(container.textContent).toContain("monitoring-report.pdf");
    expect(container.textContent).toContain("Open full review");
    expect(container.textContent).toContain("Change evidence");
    expect(container.textContent).toContain("Check another claim");

    await act(async () => {
      clickButton("Open full review");
    });

    expect(pushMock).toHaveBeenCalledWith("/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=R-1-0001");
    expect(loadPins("AR-ACM0003", "v02-0")[0]?.ruleId).toBe("R-1-0001");
    expect(window.localStorage.getItem("verify:AR-ACM0003:v02-0")).toContain("R-1-0001");
  });

  it("shows an ambiguous match chooser when the claim maps to multiple likely requirements", async () => {
    window.localStorage.setItem(
      "a6:quick-check:claim-first:v1",
      JSON.stringify({
        draft: {
          id: "draft-ambiguous",
          claimText: "The boundary description matches the mapped project area.",
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
            filename: "boundary.pdf",
            mime: "application/pdf",
            createdAt: "2026-04-04T00:00:00Z",
            attachment: {
              id: "att-upload-1",
              pin_id: "upload-1",
              filename: "boundary.pdf",
              mime: "application/pdf",
              size: 256,
              sha256: "sha-upload-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          },
        ],
      }),
    );

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    expect(primaryCta().disabled).toBe(false);

    await act(async () => {
      clickButton("Run quick check");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Likely requirement matches");
    expect(container.textContent).toContain("Multiple requirements could fit this claim.");
    expect(container.textContent).toContain("Boundary consistency");
    expect(container.textContent).toContain("R-1-0002");
    expect(container.textContent).toContain("Boundary delineation");
    expect(container.textContent).toContain("R-2-0001");
  });

  it("renders recovery actions when no clear match is found", async () => {
    seedSession({ claimText: "unsupported claim", filename: "baseline.pdf" });
    await seedAttachmentText(
      "att-upload-1",
      "%PDF-1.4\n(Spreadsheet workbook annex referenced for evidence.)\n%%EOF",
    );

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("No clear match yet");
    expect(container.textContent).toContain("Detected from evidence");
    expect(container.textContent).toContain("The workbook is referenced in the PDD");
    expect(container.textContent).toContain("Try another methodology");
    expect(container.textContent).toContain("Edit claim");
    expect(container.textContent).toContain("Open Methods");
  });

  it("returns a plausible result for a PDD boundary claim using parsed uploaded evidence", async () => {
    seedSession({ claimText: "The project boundary is described in the PDD", filename: "malawi-pdd.pdf" });
    await seedAttachmentText("att-upload-1", "%PDF-1.4\n(Project boundary description for the Malawi project.)\n%%EOF");

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("Boundary consistency");
    expect(container.textContent).toContain("Open full review");
  });

  it("returns a plausible result for a monitoring-plan claim using parsed uploaded evidence", async () => {
    seedSession({ claimText: "The project has a documented monitoring plan", filename: "malawi-pdd.pdf" });
    await seedAttachmentText("att-upload-1", "%PDF-1.4\n(Documented monitoring plan for the project.)\n%%EOF");

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("Monitoring plan");
    expect(container.textContent).toContain("Open full review");
  });

  it("returns a plausible result for a five-plots workbook claim", async () => {
    seedSession({
      claimText: "Monitoring data exists for five plots",
      filename: "malawi-monitoring.csv",
      mime: "text/csv",
      workbookAsset: {
        workbook_id: "wbk-1",
        file_kind: "csv",
        file_name: "malawi-monitoring.csv",
        file_sha256: "sha-workbook-1",
        sheet_count: 1,
        sheets: [
          {
            sheet_name: "Monitoring",
            sheet_index: 0,
            row_count: 6,
            column_count: 3,
            bounds_ref: "A1:C6",
            header_row_ref: 1,
            header_columns: ["plot_id", "monitoring_period", "qa_status"],
            warnings: [],
          },
        ],
        record_groups: [
          {
            group_id: "wbg-1",
            group_type: "sampling_log",
            display_name: "Monitoring log",
            workbook_id: "wbk-1",
            workbook_filename: "malawi-monitoring.csv",
            source_sheet: "Monitoring",
            source_range: "A1:C6",
            row_count: 5,
            column_names: ["plot_id", "monitoring_period", "qa_status"],
            rows: [
              { plot_id: "P-1", monitoring_period: "2026-Q1", qa_status: "checked" },
              { plot_id: "P-2", monitoring_period: "2026-Q1", qa_status: "checked" },
              { plot_id: "P-3", monitoring_period: "2026-Q1", qa_status: "checked" },
              { plot_id: "P-4", monitoring_period: "2026-Q1", qa_status: "checked" },
              { plot_id: "P-5", monitoring_period: "2026-Q1", qa_status: "checked" },
            ],
            provenance_summary: "malawi-monitoring.csv • Monitoring • A1:C6",
          },
        ],
        warnings: [],
      },
    });

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("Workbook monitoring records");
    expect(container.textContent).toContain("Open full review");
  });

  it("returns a plausible result for a Q1 workbook claim", async () => {
    seedSession({
      claimText: "The workbook contains Q1 monitoring records",
      filename: "malawi-monitoring.csv",
      mime: "text/csv",
      workbookAsset: {
        workbook_id: "wbk-2",
        file_kind: "csv",
        file_name: "malawi-monitoring.csv",
        file_sha256: "sha-workbook-2",
        sheet_count: 1,
        sheets: [
          {
            sheet_name: "Monitoring",
            sheet_index: 0,
            row_count: 3,
            column_count: 2,
            bounds_ref: "A1:B3",
            header_row_ref: 1,
            header_columns: ["plot_id", "monitoring_period"],
            warnings: [],
          },
        ],
        record_groups: [
          {
            group_id: "wbg-2",
            group_type: "monitoring_period_table",
            display_name: "Monitoring periods",
            workbook_id: "wbk-2",
            workbook_filename: "malawi-monitoring.csv",
            source_sheet: "Monitoring",
            source_range: "A1:B3",
            row_count: 2,
            column_names: ["plot_id", "monitoring_period"],
            rows: [
              { plot_id: "P-1", monitoring_period: "2026-Q1" },
              { plot_id: "P-2", monitoring_period: "2026-Q1" },
            ],
            provenance_summary: "malawi-monitoring.csv • Monitoring • A1:B3",
          },
        ],
        warnings: [],
      },
    });

    await act(async () => {
      root.render(<QuickCheckPanel />);
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    expect(container.textContent).toContain("Workbook monitoring records");
    expect(container.textContent).toContain("Open full review");
  });

  it("does not silently suppress an obvious match when methodology narrowing is enabled", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel initialMethod="AR-AMS0007" initialVersion="v01-0" />);
    });

    await act(async () => {
      clickButton("The boundary description matches the mapped project area.");
      clickButton("Use saved evidence instead");
    });

    const inventorySelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      inventorySelect.value = "ev-ams-1";
      inventorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      clickButton("Run quick check");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Boundary delineation");
  });
});
