/** @jest-environment jsdom */

import { describe, expect, it } from "@jest/globals";
import { analyzeQuickCheckEvidence, buildLocalRuleCandidates, buildQuickCheckQueryTexts, classifyQuickCheckClaimIntents } from "@/lib/chat/quickCheckEvidence";
import { parseWorkbookEvidenceAsset } from "@/lib/evidence/workbook";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

describe("quick check evidence analysis", () => {
  it("extracts grounded PDD facts from uploaded pdf evidence", async () => {
    const bytes = asArrayBuffer(
      new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Length 132 >>\nstream\n(Project boundary description for the Malawi grouped activity.)\n(Project location: Machinga District, Malawi.)\n(Project coordinates: -15.2345, 35.6789.)\n(The mapped project area polygon and AOI are referenced in the boundary map.)\n(Documented monitoring plan for the project.)\n(Spreadsheet workbook annex referenced for monitoring evidence.)\nendstream\nendobj\n%%EOF",
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
        "Project coordinates are present in the PDD",
        "The PDD references the mapped project area or AOI",
        "The project location is described in the PDD",
        "The project has a documented monitoring plan",
        "The workbook is referenced in the PDD",
        "The project has documented monitoring evidence",
      ]),
    );
  });

  it("classifies boundary/location claim intents and uses them to boost in-scope boundary candidates", () => {
    const claimText = "The boundary description matches the mapped project area coordinates and AOI.";
    const claimIntents = classifyQuickCheckClaimIntents(claimText);

    expect(claimIntents).toEqual(
      expect.arrayContaining(["boundary", "mapped-area", "coordinates", "aoi"]),
    );

    const candidates = buildLocalRuleCandidates({
      claimText,
      facts: [
        {
          id: "fact-boundary",
          category: "boundary",
          summary: "The project boundary is described in the PDD",
          matchText: "project boundary described",
          sourceLabel: "synthetic-malawi-pdd.pdf",
        },
        {
          id: "fact-mapped-area",
          category: "mapped-area",
          summary: "The PDD references the mapped project area or AOI",
          matchText: "mapped project area referenced",
          sourceLabel: "synthetic-malawi-pdd.pdf",
        },
      ],
      claimIntents,
      rules: [
        {
          id: "R-1-0002",
          title: "Boundary consistency",
          snippet: "Boundary description aligns to the mapped area and project coordinates.",
          tags: ["boundary", "mapped-area"],
        },
        {
          id: "R-1-0009",
          title: "Monitoring frequency",
          snippet: "Maintain a monitoring report for the reporting period.",
          tags: ["monitoring"],
        },
      ],
    });

    expect(candidates[0]?.requirementId).toBe("R-1-0002");
    expect(candidates[0]?.score).toBeGreaterThan(candidates[1]?.score ?? 0);
  });

  it("adds intent- and evidence-driven boundary/location retrieval queries", () => {
    const claimText = "The boundary description matches the mapped project area";
    const queries = buildQuickCheckQueryTexts(claimText, [
      {
        id: "fact-boundary",
        category: "boundary",
        summary: "The project boundary is described in the PDD",
        matchText: "project boundary described",
        sourceLabel: "synthetic-malawi-pdd.pdf",
      },
      {
        id: "fact-coordinates",
        category: "coordinates",
        summary: "Project coordinates are present in the PDD",
        matchText: "project coordinates present",
        sourceLabel: "synthetic-malawi-pdd.pdf",
      },
    ]);

    expect(queries).toEqual(
      expect.arrayContaining([
        claimText,
        "project boundary described",
        "project coordinates present",
        "mapped area boundary",
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
