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
      metadata: { parser: 'pdf-parse' },
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
    const body = await res.json() as { drafts: unknown[]; message: string };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual([]);
    expect(body.message).toBe('No structured CAR/CL/FAR findings detected. You can still add findings manually.');
  });

  it('returns a distinct truthful message when PDF extraction fails', async () => {
    extractPdfPagesWithPdfParseMock.mockRejectedValueOnce({
      name: 'PdfExtractionError',
      message: 'PDF extraction failed. Page extraction: broken pdf. Text fallback: No extractable text found in PDF..',
      diagnostics: {
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
      diagnostics?: { likelyScannedOrImageOnly?: boolean; textFallbackAttempted?: boolean; pageExtractionError?: string };
    };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual([]);
    expect(body.extractionFailed).toBe(true);
    expect(body.message).toBe('Could not extract findings from this PDF. You can still add findings manually.');
    expect(body.diagnosticSummary).toBe('likely scanned/image-only');
    expect(body.diagnostics).toEqual(expect.objectContaining({
      pageExtractionError: 'broken pdf',
      textFallbackAttempted: true,
      likelyScannedOrImageOnly: true,
    }));
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
      metadata: { parser: 'pdf-parse' },
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
    const body = await res.json() as { drafts: Array<{ findingId: string; extractionStatus: string }>; message: string };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: 'F-001',
          extractionStatus: 'needs-review',
        }),
      ]),
    );
  });
});
