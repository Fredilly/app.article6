/** @jest-environment jsdom */

import { describe, expect, it } from "@jest/globals";
import { analyzeQuickCheckEvidence } from "@/lib/chat/quickCheckEvidence";
import { parseWorkbookEvidenceAsset } from "@/lib/evidence/workbook";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

describe("quick check evidence analysis", () => {
  it("extracts grounded PDD facts from uploaded pdf evidence", async () => {
    const bytes = asArrayBuffer(
      new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Length 132 >>\nstream\n(Project boundary description for the Malawi grouped activity.)\n(Documented monitoring plan for the project.)\n(Spreadsheet workbook annex referenced for monitoring evidence.)\nendstream\nendobj\n%%EOF",
      ),
    );

    await putAttachmentBytes("att-pdd-1", bytes);

    const analysis = await analyzeQuickCheckEvidence([
      {
        evidenceId: "ev-pdd-1",
        sourceLabel: "malawi-pdd.pdf",
        attachments: [
          {
            id: "att-pdd-1",
            pin_id: "ev-pdd-1",
            filename: "malawi-pdd.pdf",
            mime: "application/pdf",
            size: bytes.byteLength,
            sha256: "sha-pdd-1",
            created_at: "2026-04-05T00:00:00Z",
          },
        ],
      },
    ]);

    expect(analysis.facts.map((fact) => fact.summary)).toEqual(
      expect.arrayContaining([
        "The project boundary is described in the PDD",
        "The project has a documented monitoring plan",
        "The workbook is referenced in the PDD",
        "The project has documented monitoring evidence",
      ]),
    );
  });

  it("extracts grounded workbook facts from normalized workbook evidence", async () => {
    const csv = [
      "plot_id,monitoring_period,qa_status",
      "P-1,2026-Q1,checked",
      "P-2,2026-Q1,checked",
      "P-3,2026-Q1,checked",
      "P-4,2026-Q1,checked",
      "P-5,2026-Q1,checked",
    ].join("\n");
    const bytes = asArrayBuffer(new TextEncoder().encode(csv));
    const workbookAsset = await parseWorkbookEvidenceAsset({
      bytes,
      filename: "malawi-monitoring.csv",
      mime: "text/csv",
      fileSha256: "sha-workbook-1",
    });

    expect(workbookAsset).toBeTruthy();

    const analysis = await analyzeQuickCheckEvidence(
      [
        {
          evidenceId: "ev-wb-1",
          sourceLabel: "malawi-monitoring.csv",
          attachments: [
            {
              id: "att-wb-1",
              pin_id: "ev-wb-1",
              filename: "malawi-monitoring.csv",
              mime: "text/csv",
              size: bytes.byteLength,
              sha256: "sha-workbook-1",
              created_at: "2026-04-05T00:00:00Z",
              workbook_asset: workbookAsset,
            },
          ],
        },
      ],
      { resolveAttachmentBytes: async () => null },
    );

    expect(analysis.facts.map((fact) => fact.summary)).toEqual(
      expect.arrayContaining([
        "Monitoring data exists for 5 plots",
        "The workbook contains 2026-Q1 monitoring records",
        "The workbook contains monitoring records",
        "The workbook includes QA summary evidence",
      ]),
    );
  });
});
