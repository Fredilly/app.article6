import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('/api/projects/manual-review/extract-findings route', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.dontMock('@/lib/chat/quickCheckPdfExtractor');
    jest.clearAllMocks();
  });

  it('returns extracted draft findings with a trace label', async () => {
    jest.doMock('@/lib/chat/quickCheckPdfExtractor', () => ({
      extractPdfPagesWithPdfParse: jest.fn().mockResolvedValue({
        text: 'CAR01 Requirement: Submit monitoring workbook. Description: Workbook totals do not reconcile. Project response: Revised workbook submitted. Closure status: Open',
        pages: [
          {
            pageNumber: 118,
            text: 'CAR01\nRequirement: Submit monitoring workbook.\nDescription: Workbook totals do not reconcile.\nProject response: Revised workbook submitted.\nClosure status: Open',
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
      }),
      PdfExtractionError: class PdfExtractionError extends Error {
        diagnostics: Record<string, unknown>;

        constructor(message: string, diagnostics: Record<string, unknown>) {
          super(message);
          this.name = 'PdfExtractionError';
          this.diagnostics = diagnostics;
        }
      },
    }));

    const { POST } = await import('@/app/api/projects/manual-review/extract-findings/route');
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

  it('returns a manual-entry fallback payload when extraction fails', async () => {
    jest.doMock('@/lib/chat/quickCheckPdfExtractor', () => {
      class PdfExtractionError extends Error {
        diagnostics: Record<string, unknown>;

        constructor(message: string, diagnostics: Record<string, unknown>) {
          super(message);
          this.name = 'PdfExtractionError';
          this.diagnostics = diagnostics;
        }
      }

      return {
        extractPdfPagesWithPdfParse: jest.fn().mockRejectedValue(new PdfExtractionError(
          'No extractable text found in PDF.',
          {
            parserPath: 'helper-pages',
            pageExtractionAttempted: true,
            textFallbackAttempted: true,
            extractedTextLength: 0,
            pageCount: 0,
            likelyScannedOrImageOnly: true,
            partialTextRecovered: false,
          },
        )),
        PdfExtractionError,
      };
    });

    const { POST } = await import('@/app/api/projects/manual-review/extract-findings/route');
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
});
