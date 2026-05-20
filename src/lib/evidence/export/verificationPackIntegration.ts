import { canonicalStringify } from '@/integrity/artifacts';
import type { DocumentFragment, ExtractedFact, CandidateLink } from '@/lib/evidence/extraction/types';
import type { ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type { DecisionRun } from '@/lib/evidence/decisions/types';

export type EvidenceIntelligenceData = {
  fragments: DocumentFragment[];
  facts: ExtractedFact[];
  candidateLinks: CandidateLink[];
  reconciliationRun?: ReconciliationRun;
  decisionRun?: DecisionRun;
};

type EvidenceLinkTarget = {
  href: string;
  label?: string;
};

export type EvidenceIntelligenceFiles = Array<{ path: string; bytes: Buffer }>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeDate(iso: string | undefined): string {
  if (!iso) return 'n/a';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso.slice(0, 16);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function anchorId(prefix: string, value: string): string {
  const compact = value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${prefix}-${compact || 'item'}`;
}

export function buildEvidenceIntelligenceJson(data: EvidenceIntelligenceData): Record<string, unknown> {
  return {
    kind: 'article6.evidence_intelligence',
    version: 1,
    summary: {
      fragmentCount: data.fragments.length,
      factCount: data.facts.length,
      candidateLinkCount: data.candidateLinks.length,
      reconciliationStatus: data.reconciliationRun?.status ?? null,
      gapCount: data.reconciliationRun?.gaps.length ?? 0,
      decisionCount: data.decisionRun?.decisions.length ?? 0,
    },
    fragments: data.fragments.map((f) => ({
      fragmentId: f.fragmentId,
      documentId: f.documentId,
      kind: f.kind,
      index: f.index,
      label: f.label,
      textLength: f.text.length,
      textPreview: f.text.slice(0, 500),
      contentSha256: f.contentSha256,
      pageStart: f.pageStart,
      pageEnd: f.pageEnd,
      sheetName: f.sheetName,
    })),
    facts: data.facts.map((f) => ({
      factId: f.factId,
      fragmentId: f.fragmentId,
      documentId: f.documentId,
      factType: f.factType,
      value: f.value,
      context: f.context,
      contentSha256: f.contentSha256,
    })),
    candidateLinks: data.candidateLinks.map((link) => ({
      linkId: link.linkId,
      factId: link.factId,
      ruleId: link.ruleId,
      ruleTitle: link.ruleTitle,
      sectionId: link.sectionId,
      matchType: link.matchType,
      confidence: link.confidence,
      contentSha256: link.contentSha256,
    })),
    reconciliation: data.reconciliationRun
      ? {
          runId: data.reconciliationRun.runId,
          status: data.reconciliationRun.status,
          loadError: data.reconciliationRun.loadError,
          reconciliationFingerprint: data.reconciliationRun.reconciliationFingerprint,
          gaps: data.reconciliationRun.gaps.map((g) => ({
            ruleId: g.ruleId,
            ruleTitle: g.ruleTitle,
            sectionId: g.sectionId,
            expectedEvidenceCount: g.expectedEvidenceIds.length,
            matchedEvidenceCount: g.matchedEvidenceIds.length,
          })),
        }
      : null,
    decisions: data.decisionRun
      ? {
          runId: data.decisionRun.runId,
          decisionSetFingerprint: data.decisionRun.decisionSetFingerprint,
          decisions: data.decisionRun.decisions.map((d) => ({
            decisionId: d.decisionId,
            ruleId: d.ruleId,
            ruleTitle: d.ruleTitle,
            status: d.status,
	          rationale: d.rationale,
	          reviewerId: d.reviewerId,
	          reviewedAt: d.reviewedAt,
	            evidenceInventoryIds: [...d.evidenceInventoryIds],
	            evidenceLinks: d.evidenceInventoryIds.map((id) => ({
	              evidenceRef: id,
	              reportAnchor: `#${anchorId('evidence-ref', id)}`,
	            })),
            provenanceHash: d.provenanceHash,
          })),
        }
      : null,
  };
}

export function buildEvidenceIntelligenceFiles(data: EvidenceIntelligenceData): EvidenceIntelligenceFiles {
  if (data.fragments.length === 0 && data.facts.length === 0 && data.candidateLinks.length === 0 && !data.reconciliationRun && !data.decisionRun) {
    return [];
  }

  const json = buildEvidenceIntelligenceJson(data);
  const jsonBytes = Buffer.from(canonicalStringify(json), 'utf8');

  const files: EvidenceIntelligenceFiles = [
    { path: 'evidence-intelligence.json', bytes: jsonBytes },
  ];

  const hasFragments = data.fragments.length > 0;
  const hasCoverage = data.reconciliationRun !== undefined;
  const hasDecisions = data.decisionRun !== undefined;

  if (hasFragments) {
    const fragmentsJson = {
      kind: 'article6.evidence_fragments',
      version: 1,
      fragments: data.fragments.map((f) => ({
        fragmentId: f.fragmentId,
        documentId: f.documentId,
        kind: f.kind,
        index: f.index,
        label: f.label,
        text: f.text,
        contentSha256: f.contentSha256,
        pageStart: f.pageStart,
        pageEnd: f.pageEnd,
        sheetName: f.sheetName,
      })),
    };
    files.push({ path: 'evidence-fragments.json', bytes: Buffer.from(canonicalStringify(fragmentsJson), 'utf8') });
  }

  if (hasCoverage) {
    const run = data.reconciliationRun!;
    const coverageJson = {
      kind: 'article6.coverage_matrix',
      version: 1,
      status: run.status,
      loadError: run.loadError ?? null,
      reconciliationFingerprint: run.reconciliationFingerprint,
      summary: {
        totalItems: run.items.length,
        gapCount: run.gaps.length,
      },
	      gaps: run.gaps.map((g) => ({
	        ruleId: g.ruleId,
	        ruleTitle: g.ruleTitle,
	        sectionId: g.sectionId,
	        expectedEvidenceIds: [...g.expectedEvidenceIds],
	        matchedEvidenceIds: [...g.matchedEvidenceIds],
	      })),
	    };
    files.push({ path: 'coverage-matrix.json', bytes: Buffer.from(canonicalStringify(coverageJson), 'utf8') });
  }

	  if (hasDecisions) {
	    const run = data.decisionRun!;
	    const decisionsJson = {
	      kind: 'article6.reviewer_decisions',
	      version: 1,
	      runId: run.runId,
	      decisionSetFingerprint: run.decisionSetFingerprint,
	      decisions: run.decisions.map((d) => ({
	        decisionId: d.decisionId,
	        ruleId: d.ruleId,
	        ruleTitle: d.ruleTitle,
	        status: d.status,
	        rationale: d.rationale,
	        reviewerId: d.reviewerId,
	        reviewedAt: d.reviewedAt,
	        evidenceInventoryIds: [...d.evidenceInventoryIds],
	        evidenceLinks: d.evidenceInventoryIds.map((id) => ({
	          evidenceRef: id,
	          reportAnchor: `#${anchorId('evidence-ref', id)}`,
	        })),
	        provenanceHash: d.provenanceHash,
	      })),
	    };
	    files.push({ path: 'reviewer-decisions.json', bytes: Buffer.from(canonicalStringify(decisionsJson), 'utf8') });
	  }

  return files;
}

export function renderEvidenceIntelligenceHtmlSections(
  data: EvidenceIntelligenceData,
  options?: { evidenceHrefById?: Record<string, EvidenceLinkTarget> },
): string {
  const sections: string[] = [];
  const fragmentsById = new Map(data.fragments.map((fragment) => [fragment.fragmentId, fragment]));
  const evidenceHrefById = options?.evidenceHrefById ?? {};
  const renderFragmentRef = (fragmentId: string) => {
    const fragment = fragmentsById.get(fragmentId);
    const location = fragment?.pageStart
      ? ` p.${fragment.pageStart}${fragment.pageEnd && fragment.pageEnd !== fragment.pageStart ? `-${fragment.pageEnd}` : ''}`
      : fragment?.sheetName
        ? ` ${fragment.sheetName}`
        : '';
    return `<a href="#${anchorId('fragment', fragmentId)}" class="ref">[${escapeHtml(fragmentId)}${escapeHtml(location)}]</a>`;
  };
  const renderEvidenceRef = (evidenceId: string) => {
    const target = evidenceHrefById[evidenceId];
    if (!target) return `<span class="ref">${escapeHtml(evidenceId)}</span>`;
    return `<a href="${escapeHtml(target.href)}" class="ref">${escapeHtml(target.label ?? evidenceId)}</a>`;
  };

  if (data.facts.length > 0) {
    const grouped = new Map<string, ExtractedFact[]>();
    for (const fact of data.facts) {
      const type = fact.factType;
      const existing = grouped.get(type) ?? [];
      existing.push(fact);
      grouped.set(type, existing);
    }

    const factRows = Array.from(grouped.entries())
      .map(([type, typeFacts]) => {
        const typeLabel = type.replace(/-/g, ' ');
        const samples = typeFacts.slice(0, 5).map((f) =>
          `<div class="muted">${escapeHtml(truncate(f.value, 120))} ${renderFragmentRef(f.fragmentId)}</div>`
        ).join('\n');
        const more = typeFacts.length > 5 ? `<div class="muted">... and ${typeFacts.length - 5} more</div>` : '';
        return `<tr>
  <td><strong>${escapeHtml(typeLabel)}</strong></td>
  <td>${typeFacts.length}</td>
  <td>${samples}${more}</td>
</tr>`;
      })
      .join('\n');

    sections.push(`
    <section class="panel">
      <h2>Extracted Facts</h2>
      <p>${data.facts.length} extracted facts across ${grouped.size} types, sourced from document fragments.</p>
      <table>
        <thead>
          <tr>
            <th>Fact Type</th>
            <th>Count</th>
            <th>Samples</th>
          </tr>
        </thead>
        <tbody>
${factRows}
        </tbody>
      </table>
    </section>`);
  }

  if (data.reconciliationRun) {
    const run = data.reconciliationRun;
    const gapRows = run.gaps.length > 0
      ? run.gaps.map((g) => `<tr>
  <td>${escapeHtml(g.ruleId)}</td>
  <td>${escapeHtml(g.ruleTitle)}</td>
  <td>${escapeHtml(g.sectionId)}</td>
  <td>${g.expectedEvidenceIds.length}</td>
  <td>${g.matchedEvidenceIds.length}</td>
</tr>`).join('\n')
      : '<tr><td colspan="5">No coverage gaps identified.</td></tr>';

    sections.push(`
    <section class="panel">
      <h2>Coverage Matrix</h2>
      <p>Reconciliation status: <strong>${escapeHtml(run.status)}</strong>${run.reconciliationFingerprint ? ` &mdash; <span class="ref">${escapeHtml(run.reconciliationFingerprint)}</span>` : ''}</p>
      <table>
        <thead>
          <tr>
            <th>Rule ID</th>
            <th>Rule Title</th>
            <th>Section</th>
            <th>Expected</th>
            <th>Matched</th>
          </tr>
        </thead>
        <tbody>
${gapRows}
        </tbody>
      </table>
    </section>`);
  }

  if (data.decisionRun && data.decisionRun.decisions.length > 0) {
    const run = data.decisionRun;
    const decisionRows = run.decisions.map((d) => `<tr>
  <td>${escapeHtml(d.ruleId)}</td>
  <td><span class="status-${d.status}">${escapeHtml(d.status)}</span></td>
  <td>${escapeHtml(truncate(d.rationale, 200))}</td>
  <td>${escapeHtml(d.reviewerId)}</td>
  <td>${safeDate(d.reviewedAt)}</td>
  <td>${d.evidenceInventoryIds.length > 0 ? d.evidenceInventoryIds.map((id) => renderEvidenceRef(id)).join(', ') : '<span class="muted">None</span>'}</td>
</tr>`).join('\n');

    sections.push(`
    <section class="panel">
      <h2>Reviewer Decisions</h2>
      <p>${run.decisions.length} reviewer decision${run.decisions.length === 1 ? '' : 's'} recorded. <span class="ref">${escapeHtml(run.decisionSetFingerprint)}</span></p>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Status</th>
            <th>Rationale</th>
            <th>Reviewer</th>
            <th>Date</th>
            <th>Evidence Refs</th>
          </tr>
        </thead>
        <tbody>
${decisionRows}
        </tbody>
      </table>
    </section>`);
  }

  if (data.fragments.length > 0) {
    const fragmentRows = data.fragments.slice(0, 20).map((f) => `<tr id="${anchorId('fragment', f.fragmentId)}">
  <td>${escapeHtml(f.fragmentId)}</td>
  <td>${escapeHtml(f.documentId)}</td>
  <td>${escapeHtml(f.kind)}</td>
  <td>${escapeHtml(f.label)}</td>
  <td>${escapeHtml(truncate(f.text, 100))}</td>
  <td><span class="ref">${escapeHtml(f.contentSha256 ?? '')}</span></td>
</tr>`).join('\n');

    const more = data.fragments.length > 20 ? `<p class="muted">... and ${data.fragments.length - 20} more fragments. Full list in evidence-fragments.json.</p>` : '';
    sections.push(`
    <section class="panel">
      <h2>Evidence Fragments</h2>
      <p>${data.fragments.length} extracted fragment${data.fragments.length === 1 ? '' : 's'} with provenance.</p>
      <table>
        <thead>
          <tr>
            <th>Fragment ID</th>
            <th>Source Doc</th>
            <th>Kind</th>
            <th>Label</th>
            <th>Preview</th>
            <th>SHA-256</th>
          </tr>
        </thead>
        <tbody>
${fragmentRows}
        </tbody>
      </table>
      ${more}
    </section>`);
  }

  return sections.join('\n');
}
