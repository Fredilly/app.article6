import { describe, expect, it } from '@jest/globals';
import { POST } from '@/app/api/projects/[id]/export-pdf/route';
import { extractPdfTextWithPdfParse } from '@/lib/chat/quickCheckPdfExtractor';
import { buildProjectExportPdf } from '@/lib/projects/exportPdf';
import type { Project } from '@/lib/projects/types';

function makeProject(reviewCount = 6): Project {
  return {
    id: 'project-12345678',
    name: 'Malawi Verification Project',
    methodCode: 'AR-AMS0007',
    methodVersion: 'v03-1',
    status: 'locked',
    createdAt: '2026-04-15T00:00:00Z',
    aoiLabel: 'Machinga District',
    reviews: Array.from({ length: reviewCount }, (_, index) => ({
      ruleId: `R-${index + 1}`,
      ruleTitle: `Verification requirement ${index + 1} for the monitoring report and workbook evidence`,
      sectionId: index < reviewCount / 2 ? 'Eligibility' : 'Monitoring',
      status: index % 5 === 0 ? 'gap' : index % 3 === 0 ? 'not-started' : 'verified',
      evidenceIds: [`evidence-${index + 1}`],
    })),
  };
}

describe('/api/projects/[id]/export-pdf route', () => {
  it('returns a parseable PDF attachment', async () => {
    const project = makeProject();
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="verification-pack-AR-AMS0007-project-.pdf"');

    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('Malawi Verification Project');
    expect(parsed.text).toContain('COVERAGE SUMMARY');
    expect(parsed.text).toContain('Verification requirement 1');
    expect(parsed.text).toContain('PROVENANCE');
  }, 15000);

  it('keeps later pages legible when the export spans multiple pages', async () => {
    const pdf = buildProjectExportPdf(makeProject(90), {
      total: 90,
      verified: 48,
      gap: 18,
      notStarted: 18,
      notApplicable: 0,
      inProgress: 6,
      percentComplete: 73,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });
    const raw = pdf.toString('utf8');

    expect(parsed.text).toContain('Verification requirement 90');
    expect(parsed.text).toContain('OPEN GAPS');
    expect(raw).toMatch(/\/Kids \[(\d+ 0 R\s*)+\] \/Count \d+/);
    expect(raw).toContain('BT');
    expect(raw).toContain('ET');
  }, 15000);
});
