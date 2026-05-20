import { describe, expect, it } from '@jest/globals';
import { buildPremiumPdf, buildPremiumZip } from '@/lib/evidence/export';
import type { PremiumExportInput } from '@/lib/evidence/export';
import type { Project } from '@/lib/projects/types';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { SourceDocument, DocumentFragment, ExtractedFact, CandidateLink } from '@/lib/evidence/extraction/types';
import type { ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type { DecisionRun } from '@/lib/evidence/decisions/types';

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
      ruleTitle: `Verification requirement ${index + 1} for monitoring`,
      sectionId: index < reviewCount / 2 ? 'Eligibility' : 'Monitoring',
      status: index % 5 === 0 ? 'gap' : index % 3 === 0 ? 'not-started' : 'verified',
      evidenceIds: [`evidence-${index + 1}`],
    })),
  };
}

function makeInventory(): EvidenceInventoryItem[] {
  return [
    {
      evidence_id: 'pin-001',
      dedupe_key: 'attachment:abc123',
      display_name: 'PDD Malawi v2.pdf',
      kind: 'pdd',
      type: 'PDD',
      source_summary: 'PDD upload',
      provenance_summary: 'PDD document',
      added_at: '2026-04-15T00:00:00Z',
      link_state: 'linked',
      linked_requirement_ids: ['R-1'],
      reconciliation_status: 'linked',
      pdd_fragments: [
        {
          fragment_id: 'frag-001',
          evidence_id: 'pin-001',
          label: 'Section 1',
          page_start: 1,
          page_end: 3,
          section_label: 'Project Description',
          section_heading: 'Project Description',
          excerpt: 'Project description excerpt',
          bbox_hint: null,
        },
      ],
    },
    {
      evidence_id: 'pin-002',
      dedupe_key: 'attachment:def456',
      display_name: 'Workbook.xlsx',
      kind: 'workbook',
      type: 'Workbook',
      source_summary: 'Workbook upload',
      provenance_summary: 'Workbook with calculations',
      added_at: '2026-04-16T00:00:00Z',
      link_state: 'unlinked',
      linked_requirement_ids: [],
    },
  ];
}

function makeSources(): SourceDocument[] {
  return [
    { id: 'src-001', fileName: 'PDD Malawi v2.pdf', mime: 'application/pdf', kind: 'pdd', sizeBytes: 500000, contentSha256: 'a'.repeat(64) },
    { id: 'src-002', fileName: 'Workbook.xlsx', mime: 'application/xlsx', kind: 'workbook', sizeBytes: 200000, contentSha256: 'b'.repeat(64) },
  ];
}

function makeFragments(): DocumentFragment[] {
  return [
    { fragmentId: 'frag-001', documentId: 'src-001', kind: 'pdd', index: 0, label: 'Section 1', text: 'Project description for Malawi. The project covers 500 ha of forest.', contentSha256: 'c'.repeat(64), pageStart: 1, pageEnd: 3 },
    { fragmentId: 'frag-002', documentId: 'src-001', kind: 'pdd', index: 1, label: 'Section 2', text: 'Baseline scenario calculation.', contentSha256: 'd'.repeat(64), pageStart: 4, pageEnd: 6 },
  ];
}

function makeFacts(): ExtractedFact[] {
  return [
    { factId: 'fact-001', fragmentId: 'frag-001', documentId: 'src-001', factType: 'location', value: 'Machinga District, Malawi', context: 'project location', contentSha256: 'e'.repeat(64) },
    { factId: 'fact-002', fragmentId: 'frag-001', documentId: 'src-001', factType: 'quantity', value: '500 ha', context: 'project area', contentSha256: 'f'.repeat(64) },
    { factId: 'fact-003', fragmentId: 'frag-002', documentId: 'src-001', factType: 'baseline-scenario', value: 'Business-as-usual deforestation', context: 'baseline description', contentSha256: 'g'.repeat(64) },
  ];
}

function makeCandidateLinks(): CandidateLink[] {
  return [
    { linkId: 'link-001', factId: 'fact-001', ruleId: 'R-1', ruleTitle: 'Location requirement', sectionId: 'S-1', matchType: 'keyword-overlap', matchReason: 'Location keyword match', confidence: 0.85, contentSha256: 'h'.repeat(64) },
    { linkId: 'link-002', factId: 'fact-002', ruleId: 'R-2', ruleTitle: 'Area requirement', sectionId: 'S-1', matchType: 'keyword-overlap', matchReason: 'Quantity keyword match', confidence: 0.75, contentSha256: 'i'.repeat(64) },
  ];
}

function makeInput(overrides?: Partial<PremiumExportInput>): PremiumExportInput {
  const base: PremiumExportInput = {
    project: makeProject(),
    coverage: {
      total: 6,
      verified: 4,
      gap: 1,
      notStarted: 1,
      notApplicable: 0,
      inProgress: 0,
      percentComplete: 83,
    },
    inventory: makeInventory(),
    sources: makeSources(),
    fragments: makeFragments(),
    facts: makeFacts(),
    candidateLinks: makeCandidateLinks(),
    reconciliationRun: {
      runId: 'rec-run-001',
      createdAt: '2026-05-01T00:00:00Z',
      projectId: 'project-12345678',
      status: 'complete',
      items: [],
      gaps: [{ ruleId: 'R-3', ruleTitle: 'Monitoring requirement', sectionId: 'S-2', expectedEvidenceIds: [], matchedEvidenceIds: [] }],
      itemFingerprint: 'j'.repeat(64),
      gapFingerprint: 'k'.repeat(64),
      reconciliationFingerprint: 'l'.repeat(64),
    },
    decisionRun: {
      runId: 'dec-run-001',
      projectId: 'project-12345678',
      createdAt: '2026-05-02T00:00:00Z',
      decisionSetFingerprint: 'm'.repeat(64),
      decisions: [
        {
          decisionId: 'dec_R-1_reviewer_abc_001',
          ruleId: 'R-1',
          ruleTitle: 'Location requirement',
          sectionId: 'S-1',
          status: 'approved',
          rationale: 'Methodology defines forest threshold which is satisfied.',
          reviewerId: 'reviewer_abc',
          reviewedAt: '2026-05-02T10:00:00Z',
          updatedAt: '2026-05-02T10:00:00Z',
          evidenceInventoryIds: ['pin-001'],
          provenanceHash: 'n'.repeat(64),
        },
        {
          decisionId: 'dec_R-2_reviewer_abc_002',
          ruleId: 'R-2',
          ruleTitle: 'Area requirement',
          sectionId: 'S-1',
          status: 'needs-review',
          rationale: 'Need more data on area calculation.',
          reviewerId: 'reviewer_abc',
          reviewedAt: '2026-05-02T11:00:00Z',
          updatedAt: '2026-05-02T11:00:00Z',
          evidenceInventoryIds: [],
          provenanceHash: 'o'.repeat(64),
        },
      ],
    },
    exportTime: '2026-05-20T00:00:00.000Z',
    pipelineVersion: '1.0.0',
  };
  return { ...base, ...overrides };
}

async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const { extractPdfTextWithPdfParse } = await import('@/lib/chat/quickCheckPdfExtractor');
  const result = await extractPdfTextWithPdfParse({ bytes });
  return result.text;
}

describe('Premium PDF Export', () => {
  it('produces a valid PDF buffer', () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.toString('utf-8', 0, 8)).toBe('%PDF-1.4');
  });

  it('includes premium export branding', () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const raw = pdf.toString('utf-8');

    expect(raw).toContain('PREMIUM EVIDENCE REPORT');
    expect(raw).toContain('Review-Grade Evidence Export');
    expect(raw).toContain('ARTICLE6');
  });

  it('includes all 9 standard sections in the content', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('EXECUTIVE SUMMARY');
    expect(text).toContain('PROJECT INFORMATION');
    expect(text).toContain('METHODOLOGY SOURCE SECTIONS');
    expect(text).toContain('EVIDENCE INVENTORY');
    expect(text).toContain('EXTRACTED FACTS');
    expect(text).toContain('COVERAGE MATRIX');
    expect(text).toContain('REVIEWER DECISIONS');
    expect(text).toContain('LIMITATIONS AND DISCLAIMERS');
    expect(text).toContain('PROVENANCE CHAIN');
  }, 15000);

  it('includes project info from the input', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('Malawi Verification Project');
    expect(text).toContain('AR-AMS0007');
    expect(text).toContain('UNFCCC');
    expect(text).toContain('Machinga District');
  }, 15000);

  it('includes evidence inventory items', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('PDD Malawi v2.pdf');
    expect(text).toContain('PDD');
    expect(text).toContain('Workbook.xlsx');
    expect(text).toContain('WORKBOOK');
  }, 15000);

  it('includes extracted facts grouped by type', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('LOCATION');
    expect(text).toContain('QUANTITY');
    expect(text).toContain('BASELINE SCENARIO');
    expect(text).toContain('Machinga District, Malawi');
    expect(text).toContain('500 ha');
  }, 15000);

  it('includes coverage matrix with rule statuses', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('VERIFIED');
    expect(text).toContain('R-1');
    expect(text).toContain('R-2');
    expect(text).toContain('Verification requirement');
    expect(text).toContain('COVERAGE GAPS');
    expect(text).toContain('R-3');
  }, 15000);

  it('includes reviewer decisions', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('APPROVED');
    expect(text).toContain('NEEDS-REVIEW');
    expect(text).toContain('forest threshold');
    expect(text).toContain('reviewer_abc');
  }, 15000);

  it('handles empty pipeline data gracefully', async () => {
    const input: PremiumExportInput = {
      project: makeProject(2),
      coverage: { total: 2, verified: 0, gap: 0, notStarted: 2, notApplicable: 0, inProgress: 0, percentComplete: 0 },
      inventory: [],
      sources: [],
      fragments: [],
      facts: [],
      candidateLinks: [],
    };
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    expect(text).toContain('PREMIUM EVIDENCE REPORT');
    expect(text).toContain('No evidence items in the inventory');
    expect(text).toContain('No extracted facts available');
    expect(text).toContain('No reviewer decisions recorded');
    expect(text).not.toMatch(/undefined|null/);
  }, 15000);

  it('does not contain restricted certification phrasing', async () => {
    const input = makeInput();
    const pdf = buildPremiumPdf(input);
    const text = await extractPdfText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength));

    const phrases = [
      'certified emission reductions are approved',
      'verification opinion: positive',
      'VCUs issued',
      'registry approved',
      'validated successfully',
    ];
    for (const phrase of phrases) {
      expect(text).not.toContain(phrase);
    }
  }, 15000);
});

describe('Premium ZIP Export', () => {
  it('produces a valid ZIP buffer', async () => {
    const input = makeInput();
    const zip = await buildPremiumZip(input);

    expect(zip).toBeInstanceOf(Buffer);
    expect(zip.length).toBeGreaterThan(500);
  });

  it('includes expected entries in the ZIP', async () => {
    const input = makeInput();
    const zipBuffer = await buildPremiumZip(input);
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(zipBuffer);

    const files = Object.keys(zip.files);
    expect(files).toContain('export.json');
    expect(files).toContain('manifest.json');
    expect(files).toContain('reports/premium-evidence-report.pdf');
    expect(files).toContain('fragments/frag-001.txt');
    expect(files).toContain('fragments/frag-002.txt');
  });

  it('contains valid JSON in export.json', async () => {
    const input = makeInput();
    const zipBuffer = await buildPremiumZip(input);
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(zipBuffer);

    const exportJson = await zip.file('export.json')!.async('string');
    const parsed = JSON.parse(exportJson);

    expect(parsed.exportMeta.projectId).toBe('project-12345678');
    expect(parsed.exportMeta.projectName).toBe('Malawi Verification Project');
    expect(parsed.project.methodCode).toBe('AR-AMS0007');
    expect(parsed.evidenceInventory).toHaveLength(2);
    expect(parsed.fragments).toHaveLength(2);
    expect(parsed.facts).toHaveLength(3);
    expect(parsed.candidateLinks).toHaveLength(2);
    expect(parsed.reconciliation.gaps).toHaveLength(1);
    expect(parsed.decisions.decisions).toHaveLength(2);
  });

  it('contains valid manifest.json with content hashes', async () => {
    const input = makeInput();
    const zipBuffer = await buildPremiumZip(input);
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(zipBuffer);

    const manifestJson = await zip.file('manifest.json')!.async('string');
    const manifest = JSON.parse(manifestJson);

    expect(manifest.exportVersion).toBe('1.0.0');
    expect(manifest.entries.length).toBeGreaterThanOrEqual(4);
    for (const entry of manifest.entries) {
      expect(entry.path).toBeTruthy();
      expect(entry.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('includes fragment text content in fragments/', async () => {
    const input = makeInput();
    const zipBuffer = await buildPremiumZip(input);
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(zipBuffer);

    const fragContent = await zip.file('fragments/frag-001.txt')!.async('string');
    expect(fragContent).toContain('Fragment ID: frag-001');
    expect(fragContent).toContain('Project description for Malawi');
  });

  it('handles empty data gracefully', async () => {
    const input: PremiumExportInput = {
      project: makeProject(),
      coverage: { total: 6, verified: 4, gap: 1, notStarted: 1, notApplicable: 0, inProgress: 0, percentComplete: 83 },
      inventory: [],
      sources: [],
      fragments: [],
      facts: [],
      candidateLinks: [],
    };
    const zipBuffer = await buildPremiumZip(input);
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(zipBuffer);

    expect(Object.keys(zip.files)).toContain('export.json');
    expect(Object.keys(zip.files)).toContain('manifest.json');
  });
});

describe('/api/projects/[id]/export-premium route', () => {
  it('returns a PDF attachment on POST with format=pdf', async () => {
    const { POST } = await import('@/app/api/projects/[id]/export-premium/route');
    const input = makeInput();
    const req = new Request('http://localhost/api/projects/project-12345678/export-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, format: 'pdf' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="premium-evidence-report-project-.pdf"');
  });

  it('returns a ZIP attachment on POST with format=zip', async () => {
    const { POST } = await import('@/app/api/projects/[id]/export-premium/route');
    const input = makeInput();
    const req = new Request('http://localhost/api/projects/project-12345678/export-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, format: 'zip' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="premium-evidence-export-project-.zip"');
  });

  it('returns 400 when project is missing', async () => {
    const { POST } = await import('@/app/api/projects/[id]/export-premium/route');
    const req = new Request('http://localhost/api/projects/project-12345678/export-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'pdf' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('defaults to PDF format when format is not specified', async () => {
    const { POST } = await import('@/app/api/projects/[id]/export-premium/route');
    const input = makeInput();
    const req = new Request('http://localhost/api/projects/project-12345678/export-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });
});
