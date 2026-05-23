import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const extractPdfPagesWithPdfParseMock = jest.fn();

jest.mock('@/lib/chat/quickCheckPdfExtractor', () => ({
  extractPdfPagesWithPdfParse: (...args: unknown[]) => extractPdfPagesWithPdfParseMock(...args),
}));

const { POST } = require('@/app/api/projects/manual-review/extract-findings/route') as typeof import('@/app/api/projects/manual-review/extract-findings/route');

function loadCcb1530AppendixPages() {
  const fixturePath = path.join(process.cwd(), 'tests/fixtures/projects/ccb1530-appendix1-pages.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    pages: Array<{ pageNumber: number; text: string }>;
  };
  return fixture.pages;
}

describe('/api/projects/manual-review/extract-findings route', () => {
  beforeEach(() => {
    extractPdfPagesWithPdfParseMock.mockReset();
  });

  it('returns extracted draft findings with a parser trace label', async () => {
    extractPdfPagesWithPdfParseMock.mockResolvedValueOnce({
      text: 'CAR01 Requirement: Submit monitoring workbook. Description: Workbook totals do not reconcile. Project response: Revised workbook submitted. Closure status: Open',
      pages: [
        {
          pageNumber: 118,
          text: 'CAR01\nRequirement: Submit monitoring workbook.\nDescription: Workbook totals do not reconcile.\nProject response: Revised workbook submitted.\nDocumentation submitted: Workbook extract.\nAudit team evaluation: Report narrative still needs one cross-reference.\nClosure status: Open',
        },
      ],
      engine: 'pdf-parse',
      metadata: {
        parser: 'pdf-parse',
        diagnostics: {
          parserPath: 'bundled-pdf-parse',
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 144,
          pageCount: 1,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: false,
        },
      },
    });

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
      },
      body: new Uint8Array([37, 80, 68, 70]).buffer,
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.traceLabel).toBe('bundled-pdf-parse');
    expect(payload.message).toContain('draft finding sections detected');
    expect(payload.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'CAR01',
          findingType: 'CAR',
          extractionStatus: 'draft',
          closureStatus: 'open',
        }),
      ]),
    );
  });

  it('returns the truthful fallback when no structured findings are detected', async () => {
    extractPdfPagesWithPdfParseMock.mockResolvedValueOnce({
      text: 'Appendix summary only',
      pages: [
        { pageNumber: 1, text: 'Appendix summary only' },
      ],
      engine: 'pdf-parse',
      metadata: {
        parser: 'pdf-parse',
        diagnostics: {
          parserPath: 'bundled-pdf-parse',
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 20,
          pageCount: 1,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: false,
        },
      },
    });

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('summary-only.pdf'),
      },
      body: '%PDF-sample',
    });

    const res = await POST(req);
    const body = await res.json() as { drafts: unknown[]; message: string; traceLabel?: string; diagnostics?: { parserPath?: string } };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual([]);
    expect(body.message).toBe('No structured CAR/CL/FAR findings detected. You can still add findings manually.');
    expect(body.traceLabel).toContain('bundled-pdf-parse');
    expect(body.diagnostics?.parserPath).toBe('bundled-pdf-parse');
  });

  it('returns a manual-entry fallback payload when extraction fails', async () => {
    extractPdfPagesWithPdfParseMock.mockRejectedValueOnce({
      name: 'PdfExtractionError',
      message: 'PDF extraction failed',
      diagnostics: {
        parserPath: 'helper-text-after-helper-pages',
        pageExtractionAttempted: true,
        pageExtractionError: 'broken pdf',
        textFallbackAttempted: true,
        textFallbackError: 'No extractable text found in PDF.',
        extractedTextLength: 0,
        pageCount: 0,
        likelyScannedOrImageOnly: true,
        partialTextRecovered: false,
      },
    });

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Uint8Array([37, 80, 68, 70]).buffer,
    });

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.extractionFailed).toBe(true);
    expect(payload.drafts).toEqual([]);
    expect(payload.message).toContain('You can still add findings manually');
    expect(payload.diagnosticSummary).toBe('likely scanned/image-only');
  });

  it('creates extraction-review drafts for the 1530 appendix sample instead of only a no-findings message', async () => {
    const pages = loadCcb1530AppendixPages();

    extractPdfPagesWithPdfParseMock.mockResolvedValueOnce({
      text: pages.map((page) => page.text).join('\n\n'),
      pages,
      engine: 'pdf-parse',
      metadata: {
        parser: 'pdf-parse',
        diagnostics: {
          parserPath: 'bundled-pdf-parse',
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 5000,
          pageCount: pages.length,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: false,
        },
      },
    });

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf'),
      },
      body: '%PDF-vcs1530',
    });

    const res = await POST(req);
    const body = await res.json() as {
      drafts: Array<{
        findingId: string;
        findingType?: string;
        sourcePageRange?: string;
        extractionStatus: string;
        documentationSubmitted?: string;
        auditTeamEvaluation?: string;
        evidenceExcerpt?: string;
      }>;
      message: string;
      traceLabel?: string;
    };

    const car01 = body.drafts.find((draft) => draft.findingId === 'CAR01');
    const far05 = body.drafts.find((draft) => draft.findingId === 'FAR05');

    expect(res.status).toBe(200);
    expect(body.message).toContain('finding sections detected');
    expect(body.traceLabel).toBe('bundled-pdf-parse');
    expect(body.drafts).toHaveLength(17);
    expect(car01).toEqual(expect.objectContaining({
      findingType: 'CAR',
      sourcePageRange: '40-41',
      extractionStatus: 'draft',
    }));
    expect(far05).toEqual(expect.objectContaining({
      findingType: 'FAR',
      sourcePageRange: '50',
      extractionStatus: 'needs-review',
    }));
    expect(far05).not.toHaveProperty('documentationSubmitted');
    expect(far05).not.toHaveProperty('auditTeamEvaluation');
    expect(far05?.evidenceExcerpt).not.toContain('APPENDIX 2: AUDIT PLAN');
  });

  it('returns a distinct file-too-large diagnostic before attempting extraction', async () => {
    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('oversized.pdf'),
      },
      body: new Uint8Array((20 * 1024 * 1024) + 1).buffer,
    });

    const res = await POST(req);
    const body = await res.json() as {
      extractionFailed: boolean;
      diagnosticSummary: string;
      diagnosticReason: string;
      diagnostics: { failureKind?: string };
    };

    expect(res.status).toBe(200);
    expect(extractPdfPagesWithPdfParseMock).not.toHaveBeenCalled();
    expect(body.extractionFailed).toBe(true);
    expect(body.diagnosticSummary).toBe('file too large');
    expect(body.diagnosticReason).toContain('20MB upload limit');
    expect(body.diagnostics.failureKind).toBe('file-too-large');
  });
});
