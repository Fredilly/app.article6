import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const extractPdfPagesWithPdfParseMock = jest.fn();

jest.mock('@/lib/chat/quickCheckPdfExtractor', () => ({
  extractPdfPagesWithPdfParse: (...args: unknown[]) => extractPdfPagesWithPdfParseMock(...args),
}));
const { POST } = require('@/app/api/projects/manual-review/extract-findings/route') as typeof import('@/app/api/projects/manual-review/extract-findings/route');

describe('/api/projects/manual-review/extract-findings route', () => {
  beforeEach(() => {
    extractPdfPagesWithPdfParseMock.mockReset();
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

  it('returns a distinct truthful message when PDF extraction fails', async () => {
    extractPdfPagesWithPdfParseMock.mockRejectedValueOnce({
      name: 'PdfExtractionError',
      message: 'PDF extraction failed. Page extraction: broken pdf. Text fallback: No extractable text found in PDF..',
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
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('broken.pdf'),
      },
      body: '%PDF-broken',
    });

    const res = await POST(req);
    const body = await res.json() as {
      drafts: unknown[];
      message: string;
      extractionFailed?: boolean;
      diagnosticSummary?: string;
      diagnostics?: { likelyScannedOrImageOnly?: boolean; textFallbackAttempted?: boolean; pageExtractionError?: string; parserPath?: string };
      traceLabel?: string;
    };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual([]);
    expect(body.extractionFailed).toBe(true);
    expect(body.message).toBe('Could not extract findings from this PDF. You can still add findings manually.');
    expect(body.diagnosticSummary).toBe('likely scanned/image-only');
    expect(body.diagnostics).toEqual(expect.objectContaining({
      parserPath: 'helper-text-after-helper-pages',
      pageExtractionError: 'broken pdf',
      textFallbackAttempted: true,
      likelyScannedOrImageOnly: true,
    }));
    expect(body.traceLabel).toContain('failed');
  });

  it('creates draft findings when extraction falls back to text-only page context', async () => {
    extractPdfPagesWithPdfParseMock.mockResolvedValueOnce({
      text: 'Appendix 1 F-001 Description: Missing annex reference. Project response: Submitted revised annex. Closure status: Open',
      pages: [
        {
          pageNumber: 1,
          text: 'Appendix 1\nF-001\nDescription: Missing annex reference.\nProject response: Submitted revised annex.\nClosure status: Open',
        },
      ],
      engine: 'pdf-parse',
      metadata: {
        parser: 'pdf-parse',
        diagnostics: {
          parserPath: 'helper-text',
          pageExtractionAttempted: true,
          textFallbackAttempted: true,
          extractedTextLength: 110,
          pageCount: 1,
          likelyScannedOrImageOnly: false,
          partialTextRecovered: true,
        },
      },
    });

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('ccb-report.pdf'),
      },
      body: '%PDF-fallback',
    });

    const res = await POST(req);
    const body = await res.json() as { drafts: Array<{ findingId: string; extractionStatus: string }>; message: string; traceLabel?: string };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'F-001',
          extractionStatus: 'needs-review',
        }),
      ]),
    );
    expect(body.traceLabel).toContain('1 drafts');
  });

  it('returns corrected FAR05 page range, requirement, and open status in the route response', async () => {
    extractPdfPagesWithPdfParseMock.mockResolvedValueOnce({
      text: 'FAR appendix sample',
      pages: [
        {
          pageNumber: 48,
          text: 'FAR No. 01 Requirement:\n6.2 - 23\nAR-ACM0003 Date: 25-04-2021\nDescription of the FAR\nCompliance with the monitoring procedure is not ensured.\nResponse from the project developer Date: 17-05-2021\nSilvicultural management activities were performed.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021\nRecommendation remains for the next period.\nFAR Open\nFAR No. 02 Requirement:\nG. 3\nCCB V3.1 Date: 25-04-2021',
        },
        {
          pageNumber: 49,
          text: 'Description of the FAR\nCompliance with environmental safeguards is not ensured.\nResponse from the project developer Date: 17-05-2021\nCommunity outreach will continue.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021\nThe project proponents will continue the communication process.\nFAR open\nFAR No. 03 Requirement:\n3.1.3\nCCB _ VCS Date: 25-04-2021\nDescription of the FAR\nTo give clarity with the monitoring and verification of the plots, individual marking in the field is necessary.\nResponse from the project developer Date: 17-05-2021\nThis request will be considered for a future verification.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 23-05-2021',
        },
        {
          pageNumber: 50,
          text: 'The project proponent will consider the durable marking of the plots for the next verifications.\nFAR Open\nFAR No. 05 Requirement:\n3.2.21(6)\nVCS Standard Date: 12-04-2022\nDescription of the FAR\nAssess if the managed species are exhibiting invasive behavior and if the management plan for mitigating the spread is being successfully implemented during each verification period.\nResponse from the project developer Date: 13-04-2022\nThe project proponent will conduct an evaluation at each verification.\nDocumentation submitted by the project developer\nEvaluation of the audit team Date: 13-04-2022\nFAR open\nAPPENDIX 2: AUDIT PLAN',
        },
        {
          pageNumber: 51,
          text: 'Audit plan content that must not be captured into FAR05.',
        },
      ],
      engine: 'pdf-parse',
      metadata: {
        parser: 'pdf-parse',
        diagnostics: {
          parserPath: 'bundled-pdf-parse',
          pageExtractionAttempted: true,
          textFallbackAttempted: false,
          extractedTextLength: 19,
          pageCount: 4,
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
      body: '%PDF-far',
    });

    const res = await POST(req);
    const body = await res.json() as {
      drafts: Array<{ findingId: string; sourcePageRange?: string; closureStatus?: string; requirement?: string; evidenceExcerpt?: string }>;
      extractionFailed?: boolean;
      traceLabel?: string;
    };

    const far05 = body.drafts.find((draft) => draft.findingId === 'FAR05');
    expect(res.status).toBe(200);
    expect(body.extractionFailed).toBeUndefined();
    expect(body.drafts).toHaveLength(4);
    expect(far05).toEqual(expect.objectContaining({
      findingId: 'FAR05',
      sourcePageRange: '50',
      closureStatus: 'open',
      requirement: '3.2.21(6)',
    }));
    expect(far05?.evidenceExcerpt).not.toContain('APPENDIX 2: AUDIT PLAN');
    expect(body.traceLabel).toContain('4 drafts');
  });
});
