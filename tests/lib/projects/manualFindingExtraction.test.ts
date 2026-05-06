import fs from 'fs';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
import { extractManualFindingDraftsFromPages } from '@/lib/projects/manualFindingExtraction';

function loadFixturePages() {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/projects/vcs1530-appendix1-sample.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    pages: Array<{ pageNumber: number; text: string }>;
  };
  return fixture.pages;
}

describe('manual finding extraction', () => {
  it('extracts CAR findings across page breaks with page ranges', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: loadFixturePages(),
      sourceDocumentName: 'VCS-1530-verification-report.pdf',
    });

    const finding = result.drafts.find((draft) => draft.findingId === 'CAR01');
    expect(finding).toBeDefined();
    expect(finding?.findingType).toBe('CAR');
    expect(finding?.sourcePageRange).toBe('118-119');
    expect(finding?.requirement).toContain('monitoring period activity data');
    expect(finding?.description).toContain('does not reconcile');
    expect(finding?.documentationSubmitted).toContain('workbook extract');
    expect(finding?.projectResponse).toContain('revised workbook');
    expect(finding?.auditTeamEvaluation).toContain('report narrative still needs');
    expect(finding?.closureStatus).toBe('open');
  });

  it('extracts CL and FAR findings', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: loadFixturePages(),
      sourceDocumentName: 'VCS-1530-verification-report.pdf',
    });

    expect(result.drafts.find((draft) => draft.findingId === 'CL02')).toEqual(
      expect.objectContaining({
        findingType: 'CL',
        closureStatus: 'closed',
      }),
    );
    expect(result.drafts.find((draft) => draft.findingId === 'FAR03')).toEqual(
      expect.objectContaining({
        findingType: 'FAR',
        closureStatus: 'open',
      }),
    );
  });

  it('extracts F-001 style findings from real-world table sections and marks uncertain types as needs review', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 142,
          text: 'Appendix 1 Findings table\nF-001\nDescription: The verification report references community training logs that were not included in the submitted evidence package.\nProject response: The project proponent stated that the missing logs will be added to the next submission.\nClosure status: Open',
        },
      ],
      sourceDocumentName: 'VCS-1530-CCB-verification-report.pdf',
    });

    expect(result.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'F-001',
          extractionStatus: 'needs-review',
          closureStatus: 'open',
        }),
      ]),
    );
  });

  it('maps generic finding ids to CAR/CL/FAR when a nearby full label makes the type clear', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 150,
          text: 'Corrective Action Request\nF-002\nDescription: The monitoring report omitted one annex reference.\nProject response: A revised annex reference list was submitted.\nClosure status: Closed',
        },
      ],
      sourceDocumentName: 'typed-finding.pdf',
    });

    expect(result.drafts[0]).toEqual(
      expect.objectContaining({
        findingId: 'F-002',
        findingType: 'CAR',
        closureStatus: 'closed',
      }),
    );
  });

  it('extracts explicit "No." finding labels used in VVB reports', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 40,
          text: 'APPENDIX 1\nCAR No. 01 Requirement:\n3.1\nDescription of the CAR\nA monitoring discrepancy was identified.\nResponse from the project developer Date: 17-05-2021\nA corrected workbook was submitted.\nDocumentation submitted by the project developer\nCorrected workbook\nEvaluation of the audit team Date: 23-05-2021\nThe correction resolves the issue.\nCAR Closed\nCL No. 02 Requirement\n2.4\nDescription of the CL\nClarify the evidence path.\nResponse from the project developer Date: 17-05-2021\nThe path was clarified.\nCL Closed\nFAR No. 03 Requirement:\n6.2\nDescription of the FAR\nContinue monitoring invasive behavior.\nResponse from the project developer Date: 17-05-2021\nThis will be addressed next period.\nFAR Open',
        },
      ],
      sourceDocumentName: 'vvb-report.pdf',
    });

    expect(result.drafts.map((draft) => draft.findingId)).toEqual(['CAR01', 'CL02', 'FAR03']);
    expect(result.drafts.map((draft) => draft.findingType)).toEqual(['CAR', 'CL', 'FAR']);
  });

  it('returns a truthful fallback when no findings are detected', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 1,
          text: 'Verification report summary. No appendix table for CAR, CL, or FAR was included in this sample.',
        },
      ],
      sourceDocumentName: 'summary-only.pdf',
    });

    expect(result.drafts).toEqual([]);
    expect(result.message).toBe('No structured CAR/CL/FAR findings detected. You can still add findings manually.');
  });

  it('marks uncertain extractions as needs review instead of pretending certainty', () => {
    const result = extractManualFindingDraftsFromPages({
      pages: [
        {
          pageNumber: 4,
          text: 'Appendix 1\nCAR09\nDescription: The appendix lists an unresolved issue but omits a clear project response or structured closure line.',
        },
      ],
      sourceDocumentName: 'uncertain-appendix.pdf',
    });

    expect(result.drafts[0]?.extractionStatus).toBe('needs-review');
    expect(result.drafts[0]?.extractionMessage).toBe('needs review');
  });
});
