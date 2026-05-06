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
    extractPdfPagesWithPdfParseMock.mockRejectedValueOnce(new Error('broken pdf'));

    const req = new Request('http://localhost/api/projects/manual-review/extract-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-article6-filename': encodeURIComponent('broken.pdf'),
      },
      body: '%PDF-broken',
    });

    const res = await POST(req);
    const body = await res.json() as { drafts: unknown[]; message: string; extractionFailed?: boolean };

    expect(res.status).toBe(200);
    expect(body.drafts).toEqual([]);
    expect(body.extractionFailed).toBe(true);
    expect(body.message).toBe('Could not extract findings from this PDF. You can still add findings manually.');
  });
});
