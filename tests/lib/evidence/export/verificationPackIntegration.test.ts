import { describe, expect, it } from '@jest/globals';
import { buildEvidenceIntelligenceFiles, renderEvidenceIntelligenceHtmlSections } from '@/lib/evidence/export';
import type { EvidenceIntelligenceData } from '@/lib/evidence/export';
import type { DocumentFragment, ExtractedFact, CandidateLink } from '@/lib/evidence/extraction/types';
import type { ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type { DecisionRun } from '@/lib/evidence/decisions/types';

function makeFragments(): DocumentFragment[] {
  return [
    { fragmentId: 'frag-001', documentId: 'doc-1', kind: 'pdd', index: 0, label: 'Section 1', text: 'Project description text.', contentSha256: 'a'.repeat(64), pageStart: 1, pageEnd: 3 },
    { fragmentId: 'frag-002', documentId: 'doc-1', kind: 'pdd', index: 1, label: 'Section 2', text: 'Baseline scenario.', contentSha256: 'b'.repeat(64), pageStart: 4, pageEnd: 6 },
  ];
}

function makeFacts(): ExtractedFact[] {
  return [
    { factId: 'fact-001', fragmentId: 'frag-001', documentId: 'doc-1', factType: 'location', value: 'Malawi', context: 'project location', contentSha256: 'c'.repeat(64) },
    { factId: 'fact-002', fragmentId: 'frag-001', documentId: 'doc-1', factType: 'quantity', value: '500 ha', context: 'area', contentSha256: 'd'.repeat(64) },
  ];
}

function makeLinks(): CandidateLink[] {
  return [
    { linkId: 'link-001', factId: 'fact-001', ruleId: 'R-1', ruleTitle: 'Location', sectionId: 'S-1', matchType: 'keyword-overlap', matchReason: 'match', confidence: 0.8, contentSha256: 'e'.repeat(64) },
  ];
}

function makeReconciliationRun(): ReconciliationRun {
  return {
    runId: 'rec-001',
    createdAt: '2026-05-01T00:00:00Z',
    projectId: 'proj-1',
    status: 'complete',
    items: [],
    gaps: [{ ruleId: 'R-3', ruleTitle: 'Monitoring', sectionId: 'S-2', expectedEvidenceIds: [], matchedEvidenceIds: [] }],
    itemFingerprint: 'f'.repeat(64),
    gapFingerprint: 'g'.repeat(64),
    reconciliationFingerprint: 'h'.repeat(64),
  };
}

function makeDecisionRun(): DecisionRun {
  return {
    runId: 'dec-001',
    projectId: 'proj-1',
    createdAt: '2026-05-02T00:00:00Z',
    decisionSetFingerprint: 'i'.repeat(64),
    decisions: [
      {
        decisionId: 'dec-001',
        ruleId: 'R-1',
        ruleTitle: 'Location',
        sectionId: 'S-1',
        status: 'approved',
        rationale: 'Evidence matches requirement.',
        reviewerId: 'reviewer_abc',
        reviewedAt: '2026-05-02T10:00:00Z',
        updatedAt: '2026-05-02T10:00:00Z',
        evidenceInventoryIds: ['EV-001'],
        provenanceHash: 'j'.repeat(64),
      },
    ],
  };
}

describe('buildEvidenceIntelligenceFiles', () => {
  it('returns empty array when no evidence data is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [] };
    expect(buildEvidenceIntelligenceFiles(data)).toEqual([]);
  });

  it('includes evidence-intelligence.json with facts', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: makeFacts(), candidateLinks: [] };
    const files = buildEvidenceIntelligenceFiles(data);
    expect(files.length).toBeGreaterThanOrEqual(1);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('evidence-intelligence.json');
    const json = JSON.parse(files.find((f) => f.path === 'evidence-intelligence.json')!.bytes.toString('utf8'));
    expect(json.kind).toBe('article6.evidence_intelligence');
    expect(json.summary.factCount).toBe(2);
  });

  it('includes evidence-fragments.json when fragments exist', () => {
    const data: EvidenceIntelligenceData = { fragments: makeFragments(), facts: [], candidateLinks: [] };
    const files = buildEvidenceIntelligenceFiles(data);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('evidence-fragments.json');
    const json = JSON.parse(files.find((f) => f.path === 'evidence-fragments.json')!.bytes.toString('utf8'));
    expect(json.kind).toBe('article6.evidence_fragments');
    expect(json.fragments).toHaveLength(2);
  });

  it('includes coverage-matrix.json when reconciliationRun is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [], reconciliationRun: makeReconciliationRun() };
    const files = buildEvidenceIntelligenceFiles(data);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('coverage-matrix.json');
    const json = JSON.parse(files.find((f) => f.path === 'coverage-matrix.json')!.bytes.toString('utf8'));
    expect(json.kind).toBe('article6.coverage_matrix');
    expect(json.gaps).toHaveLength(1);
    expect(json.status).toBe('complete');
  });

  it('includes reviewer-decisions.json when decisionRun is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [], decisionRun: makeDecisionRun() };
    const files = buildEvidenceIntelligenceFiles(data);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('reviewer-decisions.json');
    const json = JSON.parse(files.find((f) => f.path === 'reviewer-decisions.json')!.bytes.toString('utf8'));
    expect(json.kind).toBe('article6.reviewer_decisions');
    expect(json.decisions).toHaveLength(1);
  });

  it('includes all files when all data is provided', () => {
    const data: EvidenceIntelligenceData = {
      fragments: makeFragments(),
      facts: makeFacts(),
      candidateLinks: makeLinks(),
      reconciliationRun: makeReconciliationRun(),
      decisionRun: makeDecisionRun(),
    };
    const files = buildEvidenceIntelligenceFiles(data);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('evidence-intelligence.json');
    expect(paths).toContain('evidence-fragments.json');
    expect(paths).toContain('coverage-matrix.json');
    expect(paths).toContain('reviewer-decisions.json');
  });

  it('produces deterministic JSON (sorted keys)', () => {
    const data: EvidenceIntelligenceData = { fragments: makeFragments(), facts: makeFacts(), candidateLinks: [] };
    const files1 = buildEvidenceIntelligenceFiles(data);
    const files2 = buildEvidenceIntelligenceFiles(data);
    for (let i = 0; i < files1.length; i++) {
      expect(files1[i].bytes.toString('utf8')).toBe(files2[i].bytes.toString('utf8'));
    }
  });
});

describe('renderEvidenceIntelligenceHtmlSections', () => {
  it('returns empty string when no evidence data is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [] };
    expect(renderEvidenceIntelligenceHtmlSections(data)).toBe('');
  });

  it('renders extracted facts section when facts exist', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: makeFacts(), candidateLinks: [] };
    const html = renderEvidenceIntelligenceHtmlSections(data);
    expect(html).toContain('Extracted Facts');
    expect(html).toContain('location');
    expect(html).toContain('quantity');
  });

  it('renders coverage matrix section when reconciliationRun is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [], reconciliationRun: makeReconciliationRun() };
    const html = renderEvidenceIntelligenceHtmlSections(data);
    expect(html).toContain('Coverage Matrix');
    expect(html).toContain('complete');
    expect(html).toContain('R-3');
  });

  it('renders reviewer decisions section when decisionRun is provided', () => {
    const data: EvidenceIntelligenceData = { fragments: [], facts: [], candidateLinks: [], decisionRun: makeDecisionRun() };
    const html = renderEvidenceIntelligenceHtmlSections(data);
    expect(html).toContain('Reviewer Decisions');
    expect(html).toContain('approved');
    expect(html).toContain('reviewer_abc');
  });

  it('renders evidence fragments section when fragments exist', () => {
    const data: EvidenceIntelligenceData = { fragments: makeFragments(), facts: [], candidateLinks: [] };
    const html = renderEvidenceIntelligenceHtmlSections(data);
    expect(html).toContain('Evidence Fragments');
    expect(html).toContain('frag-001');
    expect(html).toContain('frag-002');
  });

  it('renders all sections when all data is provided', () => {
    const data: EvidenceIntelligenceData = {
      fragments: makeFragments(),
      facts: makeFacts(),
      candidateLinks: makeLinks(),
      reconciliationRun: makeReconciliationRun(),
      decisionRun: makeDecisionRun(),
    };
    const html = renderEvidenceIntelligenceHtmlSections(data);
    expect(html).toContain('Extracted Facts');
    expect(html).toContain('Coverage Matrix');
    expect(html).toContain('Reviewer Decisions');
    expect(html).toContain('Evidence Fragments');
  });
});

describe('Verification pack contract integration', () => {
  it('buildVerificationPackContractFiles includes evidence intelligence files when data is provided', async () => {
    const { buildVerificationPackContractFiles } = await import('@/exports/verificationPackContract');
    const data: EvidenceIntelligenceData = {
      fragments: makeFragments(),
      facts: makeFacts(),
      candidateLinks: makeLinks(),
      reconciliationRun: makeReconciliationRun(),
      decisionRun: makeDecisionRun(),
    };

    const files = buildVerificationPackContractFiles({
      generatedAt: '2026-05-20T00:00:00.000Z',
      methodCode: 'VM0007',
      version: 'v1.0',
      rulesJson: [],
      sectionsJson: [],
      trace: {
        sections: [],
        rules: [],
        rule_to_evidence: {},
        verification_contract: {
          mode: 'demo_placeholder_review_contract',
          project_path: 'project.json',
          evidence_manifest_path: 'evidence-manifest.json',
          requirement_review_path: 'requirement-review.json',
          trail_path: 'trail.jsonl',
          report_path: 'VERIFICATION_REPORT.html',
          placeholder: true,
          placeholder_reason: 'test',
        },
        rule_to_review: {},
        rule_to_section: {},
        section_to_rules: {},
      } as any,
      evidenceIntelligence: data,
    });

    const paths = files.map((f) => f.path);
    expect(paths).toContain('evidence-intelligence.json');
    expect(paths).toContain('evidence-fragments.json');
    expect(paths).toContain('coverage-matrix.json');
    expect(paths).toContain('reviewer-decisions.json');
  });

  it('includes evidence intelligence sections in HTML report when data is provided', async () => {
    const { buildVerificationPackContract } = await import('@/exports/verificationPackContract');
    const data: EvidenceIntelligenceData = {
      fragments: makeFragments(),
      facts: makeFacts(),
      candidateLinks: makeLinks(),
      reconciliationRun: makeReconciliationRun(),
      decisionRun: makeDecisionRun(),
    };

    const contract = buildVerificationPackContract({
      generatedAt: '2026-05-20T00:00:00.000Z',
      methodCode: 'VM0007',
      version: 'v1.0',
      rulesJson: [],
      sectionsJson: [],
      trace: {
        sections: [],
        rules: [],
        rule_to_evidence: {},
        verification_contract: {
          mode: 'demo_placeholder_review_contract',
          project_path: 'project.json',
          evidence_manifest_path: 'evidence-manifest.json',
          requirement_review_path: 'requirement-review.json',
          trail_path: 'trail.jsonl',
          report_path: 'VERIFICATION_REPORT.html',
          placeholder: true,
          placeholder_reason: 'test',
        },
        rule_to_review: {},
        rule_to_section: {},
        section_to_rules: {},
      } as any,
      evidenceIntelligence: data,
    });

    expect(contract.reportHtml).toContain('Extracted Facts');
    expect(contract.reportHtml).toContain('Coverage Matrix');
    expect(contract.reportHtml).toContain('Reviewer Decisions');
    expect(contract.reportHtml).toContain('Evidence Fragments');
    expect(contract.reportHtml).toContain('location');
    expect(contract.reportHtml).toContain('approved');
  });

  it('does not include evidence intelligence sections when data is not provided', async () => {
    const { buildVerificationPackContract } = await import('@/exports/verificationPackContract');

    const contract = buildVerificationPackContract({
      generatedAt: '2026-05-20T00:00:00.000Z',
      methodCode: 'VM0007',
      version: 'v1.0',
      rulesJson: [],
      sectionsJson: [],
      trace: {
        sections: [],
        rules: [],
        rule_to_evidence: {},
        verification_contract: {
          mode: 'demo_placeholder_review_contract',
          project_path: 'project.json',
          evidence_manifest_path: 'evidence-manifest.json',
          requirement_review_path: 'requirement-review.json',
          trail_path: 'trail.jsonl',
          report_path: 'VERIFICATION_REPORT.html',
          placeholder: true,
          placeholder_reason: 'test',
        },
        rule_to_review: {},
        rule_to_section: {},
        section_to_rules: {},
      } as any,
    });

    expect(contract.reportHtml).not.toContain('Extracted Facts');
    expect(contract.reportHtml).not.toContain('Coverage Matrix');
    expect(contract.reportHtml).not.toContain('Reviewer Decisions');
  });
});
