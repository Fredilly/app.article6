import { describe, expect, it } from '@jest/globals';
import { POST } from '@/app/api/projects/[id]/export-pdf/route';
import { extractPdfPagesWithPdfParse, extractPdfTextWithPdfParse } from '@/lib/chat/quickCheckPdfExtractor';
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
    extractedManualFindingDrafts: [],
    learningCases: [],
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
    const pdf = await buildProjectExportPdf(makeProject(90), {
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

  it('renders a standard-aware readiness report for Verra projects', async () => {
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

    expect(parsed.text).toContain('VERRA READINESS REPORT');
    expect(parsed.text).toContain('METHODOLOGY SOURCE SECTIONS');
    expect(parsed.text).toContain('APPLICABILITY CONDITIONS');
    expect(parsed.text).toContain('Registry: Verra');
    expect(parsed.text).toContain('Standard: VCS');
    expect(parsed.text).toContain('VM0007');
    expect(parsed.text).not.toMatch(/fallback|stub|not yet implemented/i);
  }, 15000);

  it('renders a standard-aware readiness report for Gold Standard projects', async () => {
    const project = {
      ...makeProject(),
      methodCode: 'GS-VER1',
      registry: 'Gold Standard' as const,
    };
    const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('GOLD STANDARD READINESS REPORT');
    expect(parsed.text).toContain('PROJECT DESIGN');
    expect(parsed.text).toContain('SAFEGUARDS');
    expect(parsed.text).toContain('Registry: Gold Standard');
    expect(parsed.text).not.toMatch(/fallback|stub|not yet implemented/i);
  }, 15000);

  it('does not contain forbidden wording for any registry', async () => {
    for (const registry of ['UNFCCC' as const, 'Verra' as const, 'Gold Standard' as const]) {
      const project = {
        ...makeProject(),
        registry,
        methodCode: registry === 'UNFCCC' ? 'AR-AMS0007' : registry === 'Verra' ? 'VM0007' : 'GS-VER1',
      };
      const req = new Request('http://localhost/api/projects/project-12345678/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const res = await POST(req);
      const bytes = await res.arrayBuffer();
      const parsed = await extractPdfTextWithPdfParse({ bytes });
      expect(parsed.text).not.toMatch(/fallback|stub|not yet implemented|registry_not_fully_supported|composer unavailable/i);
    }
  }, 30000);

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
          fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2400,
          uploadedAt: '2026-04-15T00:00:00Z',
          extractedText: 'CCB and VCS verification report excerpt',
        },
      ],
      manualFindings: [
        {
          id: 'finding-1',
          findingId: 'CAR01',
          findingType: 'CAR',
          sourceDocumentId: 'doc-1',
          sourcePageRange: '40-41',
          requirement: 'CCB V3.1: G1.10',
          description: 'Monitoring report omits appendix references.',
          evidenceExcerpt: 'Monitoring report omits appendix references.',
          projectResponse: 'Appendix references will be added.',
          documentationSubmitted: 'Revised appendix set',
          auditTeamEvaluation: 'Awaiting updated published report',
          closureStatus: 'open',
          reviewerNote: 'Hold open until revised report lands.',
          createdAt: '2026-04-15T00:00:00Z',
          updatedAt: '2026-04-15T00:00:00Z',
        },
      ],
      extractedManualFindingDrafts: [],
      learningCases: [],
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
    expect(parsed.text).toContain('VVB FINDINGS RECONSTRUCTION');
    expect(parsed.text).not.toContain('VERIFICATION REPORT UNFCCC');
    expect(parsed.text).not.toContain('UNFCCC VERIFICATION REPORT');
    expect(parsed.text).toContain('This report reconstructs findings from uploaded source documents.');
    expect(parsed.text).toContain('Manual review mode: true');
    expect(parsed.text).toContain('Verra Reconstruction Workspace');
    expect(parsed.text).not.toContain('AR-AMS0007');
    expect(parsed.text).toContain('Registry / Standard: Verra / VCS + CCB');
    expect(parsed.text).toContain('CAR: 1');
    expect(parsed.text).toContain('CL: 0');
    expect(parsed.text).toContain('FAR: 0');
    expect(parsed.text).not.toContain('NC: 1');
    expect(parsed.text).toContain('Finding ID');
    expect(parsed.text).toContain('Source page/range');
    expect(parsed.text).toContain('Project response');
    expect(parsed.text).toContain('Documentation submitted');
    expect(parsed.text).toContain('Audit team evaluation');
    expect(parsed.text).toContain('Source excerpt');
    expect(parsed.text).toContain('PROVENANCE AND LIMITATIONS');
    expect(parsed.text).not.toContain('undefined @ undefined');
    expect(parsed.text).not.toContain('determination..');
    expect(parsed.text).not.toMatch(/â|â|ˆ‡|ˆ–|ˆ¡|ˆ'|´°/);
  }, 15000);

  it('uses a methodology-linked footer label for non-manual exports', async () => {
    const project = makeProject();
    const pdf = await buildProjectExportPdf(project, {
      total: 6,
      verified: 4,
      gap: 1,
      notStarted: 1,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 83,
    });
    const raw = pdf.toString('utf8');

    expect(raw).toContain('article6.org | Verification Report');
    expect(raw).not.toContain('Manual Review Export');
  }, 15000);

  it('uses an ASCII-safe footer separator instead of a middle dot or other non-ASCII glyph', async () => {
    const project: Project = {
      id: 'manual-project-footer',
      name: 'Footer Test Workspace',
      reviewMode: 'manual',
      registry: 'Unknown',
      status: 'locked',
      createdAt: '2026-04-15T00:00:00Z',
      documents: [],
      manualFindings: [],
      extractedManualFindingDrafts: [],
      learningCases: [],
      reviews: [],
    };
    const req = new Request('http://localhost/api/projects/manual-project-footer/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('article6.org | Manual Review Export');
    expect(parsed.text).not.toContain('article6.org \u00B7 Manual Review Export');
  }, 15000);

  it('keeps the manual review provenance block together instead of spilling a sentence fragment onto a nearly blank final page', async () => {
    const project: Project = {
      id: 'manual-project-15',
      name: 'Long Manual Review Workspace',
      reviewMode: 'manual',
      registry: 'Unknown',
      status: 'locked',
      createdAt: '2026-04-15T00:00:00Z',
      documents: [
        {
          id: 'doc-1',
          fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 420000,
          uploadedAt: '2026-04-15T00:00:00Z',
          extractedText: 'Appendix 1 CAR/CL/FAR findings excerpt',
        },
      ],
      manualFindings: Array.from({ length: 17 }, (_, index) => ({
        id: `finding-${index + 1}`,
        findingId: index < 7 ? `CAR0${index + 1}` : index < 13 ? `CL0${index - 6}` : `FAR0${index - 12}`,
        findingType: index < 7 ? 'CAR' : index < 13 ? 'CL' : 'FAR',
        sourceDocumentId: 'doc-1',
        sourcePageRange: `${40 + index}-${41 + index}`,
        requirement: `Requirement reference ${index + 1} with enough text to wrap cleanly across the PDF card layout.`,
        description: `Structured description for finding ${index + 1} explaining the reconstructed VVB issue in a compact but still realistic way.`,
        evidenceExcerpt: `Source excerpt for finding ${index + 1} that remains visible for traceability while staying visually secondary in the report.`,
        projectResponse: `Project response for finding ${index + 1} documenting the project-side remediation or clarification text used in the reconstruction.`,
        documentationSubmitted: `Supporting attachment set ${index + 1} with workbook, report appendix, and memo references.`,
        auditTeamEvaluation: `Audit team evaluation for finding ${index + 1} describing the recorded closure or remaining follow-up from the source report.`,
        closureStatus: index < 13 ? 'closed' : 'open',
        reviewerNote: `Reviewer note ${index + 1} captured in the manual review workspace.`,
        createdAt: '2026-04-15T00:00:00Z',
        updatedAt: '2026-04-15T00:00:00Z',
      })),
      extractedManualFindingDrafts: [],
      learningCases: [],
      reviews: [],
    };

    const req = new Request('http://localhost/api/projects/manual-project-15/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });
    const res = await POST(req);
    const bytes = await res.arrayBuffer();
    const parsed = await extractPdfPagesWithPdfParse({ bytes });
    const lastPageText = parsed.pages.at(-1)?.text ?? '';
    const lastPageWordCount = lastPageText.split(/\s+/).filter(Boolean).length;

    expect(lastPageText).toContain('PROVENANCE AND LIMITATIONS');
    expect(lastPageText).toContain('Manual review mode: true');
    expect(lastPageText).toContain('Methodology / reference: Manual review - methodology not wired');
    expect(lastPageWordCount).toBeGreaterThan(25);
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
    const pdf = await buildProjectExportPdf(project, {
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
    const pdf = await buildProjectExportPdf(project, {
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

    expect(parsed.text).toContain('No Article6 reviewer note added.');
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
    const pdf = await buildProjectExportPdf(project, {
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
    const pdf = await buildProjectExportPdf(project, {
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
    const pdf = await buildProjectExportPdf(project, {
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
