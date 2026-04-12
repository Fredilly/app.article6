/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";
import { analyzeQuickCheckEvidence, buildLocalRuleCandidates, buildQuickCheckQueryTexts, classifyQuickCheckClaimIntents, extractPdfText } from "@/lib/chat/quickCheckEvidence";
import { buildQuickCheckExtractionSnapshot, deriveQuickCheckExtractionState } from "@/lib/chat/quickCheckUi";
import { parseWorkbookEvidenceAsset } from "@/lib/evidence/workbook";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

describe("quick check evidence analysis", () => {
  it("extracts real text and usable claim-support signals from a strong-signal PDF fixture", async () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/quick-check/malawi-strong-signal-evidence.pdf");
    const bytes = fs.readFileSync(fixturePath);
    const arrayBuffer = asArrayBuffer(bytes);

    await putAttachmentBytes("att-pdf-strong-1", arrayBuffer);

    const extractedText = extractPdfText(arrayBuffer);
    const compactExtractedText = compactText(extractedText);
    expect(compactExtractedText).toContain(compactText("Gold Standard TPDD TEC Version 4.0"));
    expect(compactExtractedText).toContain(compactText("1 January 2025 to 31 December 2025"));
    expect(compactExtractedText).toContain(compactText("Project area Lilongwe District and Machinga District"));
    expect(compactExtractedText).toContain(compactText("Claim support The monitoring report covers the full reporting period"));

    const analysis = await analyzeQuickCheckEvidence([
      {
        evidenceId: "ev-pdf-strong-1",
        sourceLabel: "malawi-strong-signal-evidence.pdf",
        attachments: [
          {
            id: "att-pdf-strong-1",
            pin_id: "ev-pdf-strong-1",
            filename: "malawi-strong-signal-evidence.pdf",
            mime: "application/pdf",
            size: bytes.byteLength,
            sha256: "sha-pdf-strong-1",
            created_at: "2026-04-08T00:00:00Z",
          },
        ],
      },
    ]);

    expect(analysis.methodologyMentions.some((mention) => compactText(mention).includes(compactText("Gold Standard TPDD TEC Version 4.0")))).toBe(true);
    expect(analysis.facts.map((fact) => fact.summary)).toEqual(
      expect.arrayContaining([
        "The PDD references the mapped project area or AOI",
        "The PDF states a monitoring or reporting period",
        "The project location is described in the PDD",
        "The project has documented monitoring evidence",
      ]),
    );

    const extraction = buildQuickCheckExtractionSnapshot({
      claimText: "The monitoring report covers the full reporting period and documents monitored stove usage for the project area.",
      analysis,
    });
    expect(deriveQuickCheckExtractionState(extraction).value).not.toBe("weak");
  });

  it("extracts text from chained ASCII85 + Flate PDF content streams and keeps Kenya out of the weak path", async () => {
    const fixturePath = path.join(process.cwd(), "tests/fixtures/quick-check/kenya-second-check-evidence.pdf");
    const bytes = fs.readFileSync(fixturePath);
    const arrayBuffer = asArrayBuffer(bytes);

    await putAttachmentBytes("att-pdf-kenya-1", arrayBuffer);

    const extractedText = extractPdfText(arrayBuffer);
    const compactExtractedText = compactText(extractedText);
    expect(compactExtractedText).toContain(compactText("Reporting period 1 April 2024 - 31 March 2025"));
    expect(compactExtractedText).toContain(compactText("Project area Makueni County and Kitui County"));
    expect(compactExtractedText).toContain(compactText("The monitoring report covers the full reporting period"));

    const analysis = await analyzeQuickCheckEvidence([
      {
        evidenceId: "ev-pdf-kenya-1",
        sourceLabel: "kenya-second-check-evidence.pdf",
        attachments: [
          {
            id: "att-pdf-kenya-1",
            pin_id: "ev-pdf-kenya-1",
            filename: "kenya-second-check-evidence.pdf",
            mime: "application/pdf",
            size: bytes.byteLength,
            sha256: "sha-pdf-kenya-1",
            created_at: "2026-04-09T00:00:00Z",
          },
        ],
      },
    ]);

    expect(analysis.parsedEvidenceLabels).toEqual(["kenya-second-check-evidence.pdf"]);
    expect(analysis.facts.map((fact) => fact.summary)).toEqual(
      expect.arrayContaining([
        "The PDD references the mapped project area or AOI",
        "The PDF states a monitoring or reporting period",
        "The project has documented monitoring evidence",
      ]),
    );

    const extraction = buildQuickCheckExtractionSnapshot({
      claimText: "The monitoring report covers the full reporting period and the boundary description matches the mapped project area.",
      analysis,
    });
    expect(deriveQuickCheckExtractionState(extraction).value).not.toBe("weak");
  });

  it("produces different extraction preview details for different evidence files", async () => {
    const malawiPath = path.join(process.cwd(), "tests/fixtures/quick-check/malawi-strong-signal-evidence.pdf");
    const kenyaPath = path.join(process.cwd(), "tests/fixtures/quick-check/kenya-second-check-evidence.pdf");
    const malawiBytes = fs.readFileSync(malawiPath);
    const kenyaBytes = fs.readFileSync(kenyaPath);

    await putAttachmentBytes("att-preview-malawi", asArrayBuffer(malawiBytes));
    await putAttachmentBytes("att-preview-kenya", asArrayBuffer(kenyaBytes));

    const claimText = "The monitoring report covers the full reporting period and documents monitored stove usage for the project area.";

    const [malawiAnalysis, kenyaAnalysis] = await Promise.all([
      analyzeQuickCheckEvidence([
        {
          evidenceId: "ev-preview-malawi",
          sourceLabel: "malawi-strong-signal-evidence.pdf",
          attachments: [
            {
              id: "att-preview-malawi",
              pin_id: "ev-preview-malawi",
              filename: "malawi-strong-signal-evidence.pdf",
              mime: "application/pdf",
              size: malawiBytes.byteLength,
              sha256: "sha-preview-malawi",
              created_at: "2026-04-13T00:00:00Z",
            },
          ],
        },
      ]),
      analyzeQuickCheckEvidence([
        {
          evidenceId: "ev-preview-kenya",
          sourceLabel: "kenya-second-check-evidence.pdf",
          attachments: [
            {
              id: "att-preview-kenya",
              pin_id: "ev-preview-kenya",
              filename: "kenya-second-check-evidence.pdf",
              mime: "application/pdf",
              size: kenyaBytes.byteLength,
              sha256: "sha-preview-kenya",
              created_at: "2026-04-13T00:00:00Z",
            },
          ],
        },
      ]),
    ]);

    const malawiPreview = buildQuickCheckExtractionSnapshot({ claimText, analysis: malawiAnalysis });
    const kenyaPreview = buildQuickCheckExtractionSnapshot({ claimText, analysis: kenyaAnalysis });

    expect(compactText(malawiPreview.extractedFacts.join(" "))).toContain(compactText("1 January 2025 to 31 December 2025"));
    expect(compactText(kenyaPreview.extractedFacts.join(" "))).toContain(compactText("1 April 2024 - 31 March 2025"));
    expect(malawiPreview.extractedFacts).not.toEqual(kenyaPreview.extractedFacts);
  });

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

  it("keeps a low-signal PDF in the weak path", async () => {
    const bytes = asArrayBuffer(new TextEncoder().encode("%%%%"));
    await putAttachmentBytes("att-pdf-weak-1", bytes);

    const extractedText = extractPdfText(bytes);
    expect(extractedText).toBe("");

    const analysis = await analyzeQuickCheckEvidence([
      {
        evidenceId: "ev-pdf-weak-1",
        sourceLabel: "opaque-scan.pdf",
        attachments: [
          {
            id: "att-pdf-weak-1",
            pin_id: "ev-pdf-weak-1",
            filename: "opaque-scan.pdf",
            mime: "application/pdf",
            size: bytes.byteLength,
            sha256: "sha-pdf-weak-1",
            created_at: "2026-04-08T00:00:00Z",
          },
        ],
      },
    ]);

    expect(analysis.facts).toEqual([]);
    expect(analysis.warnings).toContain("We couldn't extract usable text from this file yet.");
  });

  it("keeps parsing when the route falls back to the heuristic parser", async () => {
    const bytes = asArrayBuffer(
      new TextEncoder().encode(
        "%PDF-1.4\n1 0 obj\n<< /Length 109 >>\nstream\n(Project area Lilongwe District.)\n(Reporting period 1 January 2025 to 31 December 2025.)\nendstream\nendobj\n%%EOF",
      ),
    );
    await putAttachmentBytes("att-pdf-fallback-1", bytes);

    const analysis = await analyzeQuickCheckEvidence(
      [
        {
          evidenceId: "ev-pdf-fallback-1",
          sourceLabel: "fallback.pdf",
          attachments: [
            {
              id: "att-pdf-fallback-1",
              pin_id: "ev-pdf-fallback-1",
              filename: "fallback.pdf",
              mime: "application/pdf",
              size: bytes.byteLength,
              sha256: "sha-pdf-fallback-1",
              created_at: "2026-04-12T00:00:00Z",
            },
          ],
        },
      ],
      {
        resolvePdfText: async ({ bytes: pdfBytes }) => ({
          text: extractPdfText(pdfBytes),
          engine: "heuristic",
        }),
      },
    );

    expect(analysis.facts.map((fact) => fact.summary)).toEqual(
      expect.arrayContaining([
        "The project location is described in the PDD",
        "The PDF states a monitoring or reporting period",
      ]),
    );
    expect(analysis.warnings).not.toContain(expect.stringContaining("fallback parser"));
  });
});
