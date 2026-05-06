import { describe, expect, it } from '@jest/globals';
import { POST } from '@/app/api/projects/[id]/export-pdf/route';
import { extractPdfTextWithPdfParse } from '@/lib/chat/quickCheckPdfExtractor';
import { buildProjectExportPdf } from '@/lib/projects/exportPdf';
import type { Project } from '@/lib/projects/types';

const UNSUPPORTED_CERTIFICATION_PHRASES = [
  'certified emission reductions are approved',
  'verification opinion: positive',
  'VCUs issued',
  'registry approved',
  'validated successfully',
  'verified successfully',
];

function makeProject(reviewCount = 6): Project {
  return {
    id: 'project-12345678',
    name: 'Malawi Verification Project',
    reviewMode: 'methodology-linked',
    methodCode: 'AR-AMS0007',
    methodVersion: 'v03-1',
    registry: 'UNFCCC',
    status: 'locked',
    createdAt: '2026-04-15T00:00:00Z',
    aoiLabel: 'Machinga District',
    documents: [],
    manualFindings: [],
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
    expect(parsed.text).toContain('UNFCCC VERIFICATION REPORT');
    expect(parsed.text).toContain('REPORT STATUS');
    expect(parsed.text).toContain('PROJECT AND METHODOLOGY IDENTIFICATION');
    expect(parsed.text).toContain('VERIFICATION SCOPE');
    expect(parsed.text).toContain('MEANS OF VERIFICATION');
    expect(parsed.text).toContain('FINDINGS SUMMARY');
    expect(parsed.text).toContain('REQUIREMENT FINDINGS');
    expect(parsed.text).toContain('EVIDENCE APPENDIX');
    expect(parsed.text).toContain('LIMITATIONS');
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
    expect(parsed.text).toContain('REQUIREMENT FINDINGS');
    expect(parsed.text).toContain('EVIDENCE APPENDIX');
    expect(raw).toMatch(/\/Kids \[(\d+ 0 R\s*)+\] \/Count \d+/);
    expect(raw).toContain('BT');
    expect(raw).toContain('ET');
  }, 15000);

  it('uses ARTICLE6 branding and the UNFCCC report title', async () => {
    const project = makeProject();
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('ARTICLE6');
    expect(parsed.text).toContain('UNFCCC VERIFICATION REPORT');
    expect(parsed.text).toContain('REQUIREMENT FINDINGS');
    expect(parsed.text).not.toContain('app.article6');
  }, 15000);

  it('renders a truthful Verra fallback instead of a fake full report', async () => {
    const project = {
      ...makeProject(),
      methodCode: 'VM0007',
      registry: 'Verra' as const,
    };
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('VERRA VERIFICATION REPORT');
    expect(parsed.text).toContain('REGISTRY SUPPORT STATUS');
    expect(parsed.text).toContain('full renderer not yet implemented');
    expect(parsed.text).not.toContain('REQUIREMENT FINDINGS');
  }, 15000);

  it('exports manual review mode without methodology code in the header copy', async () => {
    const project: Project = {
      id: 'manual-project-1',
      name: 'Verra Reconstruction Workspace',
      reviewMode: 'manual',
      registry: 'Unknown',
      status: 'locked',
      createdAt: '2026-04-15T00:00:00Z',
      documents: [
        {
          id: 'doc-1',
          fileName: 'project-monitoring-report.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2400,
          uploadedAt: '2026-04-15T00:00:00Z',
          extractedText: 'Project monitoring report excerpt',
        },
      ],
      manualFindings: [
        {
          id: 'finding-1',
          findingId: 'F-001',
          findingType: 'VVB finding',
          sourceDocumentId: 'doc-1',
          evidenceExcerpt: 'Monitoring report omits appendix references.',
          projectResponse: 'Appendix references will be added.',
          closureStatus: 'open',
          reviewerNote: 'Hold open until revised report lands.',
          createdAt: '2026-04-15T00:00:00Z',
          updatedAt: '2026-04-15T00:00:00Z',
        },
      ],
      reviews: [],
    };
    const req = new Request('http://localhost/api/projects/manual-project-1/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="manual-review-pack-manual-p.pdf"');
    expect(parsed.text).toContain('MANUAL REVIEW REPORT');
    expect(parsed.text).toContain('Manual review mode: true');
    expect(parsed.text).toContain('Verra Reconstruction Workspace');
    expect(parsed.text).not.toContain('AR-AMS0007');
  }, 15000);

  it('renders reviewer rationale under rules that have notes', async () => {
    const project = makeProject(3);
    project.reviews[0] = {
      ...project.reviews[0],
      status: 'verified',
      note: 'Monitoring report confirms coverage of the full reporting period.',
    };
    project.reviews[1] = {
      ...project.reviews[1],
      status: 'gap',
      note: 'Boundary worksheet not provided.',
    };
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('Monitoring report confirms coverage');
    expect(parsed.text).toContain('Boundary worksheet not provided');
  }, 15000);

  it('wraps long reviewer rationale and long evidence references without dropping audit text', async () => {
    const longEvidenceId = 'evidence-' + '0123456789abcdef'.repeat(10);
    const project = makeProject(1);
    project.reviews[0] = {
      ...project.reviews[0],
      status: 'verified',
      note: 'This unusually detailed reviewer rationale should remain visible in the exported PDF because it explains the sampled invoices, monitoring workbook cross-check, and boundary reconciliation used for the draft assessment.',
      evidenceIds: [longEvidenceId],
    };
    const pdf = buildProjectExportPdf(project, {
      total: 1,
      verified: 1,
      gap: 0,
      notStarted: 0,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 100,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('sampled invoices, monitoring workbook cross-check');
    expect(parsed.text).toContain('boundary reconciliation used for the draft assessment');
    expect(parsed.text).toContain('0123456789abcdef0123456789abcdef');
  }, 15000);

  it('shows a visible limitation for verified rules that lack evidence and rationale', async () => {
    const project = makeProject(1);
    project.reviews[0] = {
      ...project.reviews[0],
      status: 'verified',
      note: undefined,
      evidenceIds: [],
    };
    const pdf = buildProjectExportPdf(project, {
      total: 1,
      verified: 1,
      gap: 0,
      notStarted: 0,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 100,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('no reviewer rationale or linked evidence reference');
    expect(parsed.text).toContain('Draft OK is support-limited');
  }, 15000);

  it('shows percentage complete in verification scope', async () => {
    const project = makeProject();
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toMatch(/\d+%/);
  }, 15000);

  it('does not render unsupported certification or issuance phrases', async () => {
    const project = makeProject();
    const pdf = buildProjectExportPdf(project, {
      total: 6,
      verified: 4,
      gap: 1,
      notStarted: 1,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 83,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    for (const phrase of UNSUPPORTED_CERTIFICATION_PHRASES) {
      expect(parsed.text).not.toContain(phrase);
    }
  }, 15000);

  it('handles missing timestamps without crashing', async () => {
    const project = makeProject();
    (project as Record<string, unknown>).createdAt = undefined;
    (project as Record<string, unknown>).lockedAt = undefined;
    const pdf = buildProjectExportPdf(project, {
      total: 6,
      verified: 4,
      gap: 1,
      notStarted: 1,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 83,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('PROVENANCE');
    expect(parsed.text).toContain('n/a');
  }, 15000);

  it('PDF text contains only ASCII-safe characters (no mojibake)', async () => {
    const project = makeProject();
    const pdf = buildProjectExportPdf(project, {
      total: 6,
      verified: 4,
      gap: 1,
      notStarted: 1,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 83,
    });
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    // Middle dot, em dash, and other non-ASCII should not appear in extracted text
    // from Type1 Helvetica streams
    expect(parsed.text).not.toMatch(/[\u00b7\u2014\u2013\u2018\u2019\u201c\u201d]/);
  }, 15000);
});
