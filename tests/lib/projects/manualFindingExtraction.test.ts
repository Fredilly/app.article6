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
