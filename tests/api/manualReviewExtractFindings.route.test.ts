import { describe, expect, it, jest } from '@jest/globals';
import { POST } from '@/app/api/projects/manual-review/extract-findings/route';

jest.mock('@/lib/chat/quickCheckPdfExtractor', () => ({
  extractPdfPagesWithPdfParse: jest.fn(async () => ({
    text: 'Appendix summary only',
    pages: [
      { pageNumber: 1, text: 'Appendix summary only' },
    ],
    engine: 'pdf-parse',
    metadata: { parser: 'pdf-parse' },
  })),
}));

describe('/api/projects/manual-review/extract-findings route', () => {
  it('returns the truthful fallback when no structured findings are detected', async () => {
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
});
