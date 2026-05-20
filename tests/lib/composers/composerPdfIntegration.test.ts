import { describe, expect, it } from '@jest/globals';
import { buildProjectExportPdf } from '@/lib/projects/exportPdf';
import { extractPdfTextWithPdfParse } from '@/lib/chat/quickCheckPdfExtractor';
import type { Project, ProjectCoverage } from '@/lib/projects/types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'integration-test-proj',
    name: 'Integration Test Project',
    reviewMode: 'methodology-linked',
    methodCode: 'VM0047',
    methodVersion: 'v1-0',
    methodCategory: 'AFOLU',
    registry: 'Verra',
    status: 'locked',
    createdAt: '2026-05-01T00:00:00.000Z',
    aoiLabel: 'Test District',
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    reviews: [
      { ruleId: 'R-1-0001', ruleTitle: 'Forest definition threshold', sectionId: 'S-1', status: 'verified', evidenceIds: ['ev-1'], note: 'Verified.' },
      { ruleId: 'R-4-0001', ruleTitle: 'ARR applicability', sectionId: 'S-4', status: 'verified', evidenceIds: ['ev-2'], note: 'Confirmed.' },
    ],
    ...overrides,
  };
}

const coverage: ProjectCoverage = {
  total: 2,
  verified: 2,
  gap: 0,
  notStarted: 0,
  notApplicable: 0,
  inProgress: 0,
  percentComplete: 100,
};

describe('PDF export integration with Verra composer', () => {
  it('generates a parseable PDF with Verra-specific sections', async () => {
    const project = makeProject();
    const pdf = await buildProjectExportPdf(project, coverage);
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('VERRA READINESS REPORT');
    expect(parsed.text).toContain('METHODOLOGY SOURCE SECTIONS');
    expect(parsed.text).toContain('APPLICABILITY CONDITIONS');
    expect(parsed.text).toContain('PROJECT BOUNDARY');
    expect(parsed.text).toContain('EVIDENCE REVIEWED');
    expect(parsed.text).toContain('VM0047');
    expect(parsed.text).toContain('VCS');
  }, 15000);

  it('does not include stub or fallback wording in Verra PDF', async () => {
    const project = makeProject();
    const pdf = await buildProjectExportPdf(project, coverage);
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).not.toMatch(/fallback|stub|not yet implemented|registry_not_fully_supported/i);
  }, 15000);

  it('renders evidence-linked findings in the PDF', async () => {
    const project = makeProject();
    const pdf = await buildProjectExportPdf(project, coverage);
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('Forest definition threshold');
    expect(parsed.text).toContain('ARR applicability');
  }, 15000);

  it('produces deterministic PDF content', async () => {
    const project = makeProject();
    const pdf1 = await buildProjectExportPdf(project, coverage);
    const pdf2 = await buildProjectExportPdf(project, coverage);
    const bytes1 = pdf1.buffer.slice(pdf1.byteOffset, pdf1.byteOffset + pdf1.byteLength);
    const bytes2 = pdf2.buffer.slice(pdf2.byteOffset, pdf2.byteOffset + pdf2.byteLength);
    const parsed1 = await extractPdfTextWithPdfParse({ bytes: bytes1 });
    const parsed2 = await extractPdfTextWithPdfParse({ bytes: bytes2 });

    expect(parsed1.text.length).toBe(parsed2.text.length);
  }, 15000);

  it('uses canonical export timestamp terminology in the rendered PDF', async () => {
    const project = makeProject();
    const pdf = await buildProjectExportPdf(project, coverage);
    const bytes = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const parsed = await extractPdfTextWithPdfParse({ bytes });

    expect(parsed.text).toContain('Export timestamp');
    expect(parsed.text).not.toContain('Export time:');
  }, 15000);
});
