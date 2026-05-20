import JSZip from 'jszip';
import type { PremiumExportInput, ManifestEntry } from './types';
import { buildPremiumPdf } from './pdfExporter';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import { createHash } from 'crypto';

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function byteLength(input: string): number {
  return Buffer.byteLength(input, 'utf-8');
}

function buildExportJson(input: PremiumExportInput): string {
  const { project, coverage, inventory, sources, fragments, facts, candidateLinks, reconciliationRun, decisionRun } = input;
  const now = input.exportTime ?? new Date().toISOString();
  const pipelineVersion = input.pipelineVersion ?? '1.0.0';

  const data = {
    exportMeta: {
      exportedAt: now,
      pipelineVersion,
      projectId: project.id,
      projectName: project.name,
    },
    project: {
      id: project.id,
      name: project.name,
      reviewMode: project.reviewMode,
      registry: project.registry,
      methodCode: project.methodCode,
      methodVersion: project.methodVersion,
      status: project.status,
      createdAt: project.createdAt,
      lockedAt: project.lockedAt,
      aoiLabel: project.aoiLabel,
      description: project.description,
    },
    coverage: {
      total: coverage.total,
      verified: coverage.verified,
      gap: coverage.gap,
      notStarted: coverage.notStarted,
      notApplicable: coverage.notApplicable,
      inProgress: coverage.inProgress,
      percentComplete: coverage.percentComplete,
    },
    evidenceInventory: inventory.map((item) => ({
      evidence_id: item.evidence_id,
      dedupe_key: item.dedupe_key,
      display_name: item.display_name,
      kind: item.kind,
      type: item.type,
      added_at: item.added_at,
      link_state: item.link_state,
      linked_requirement_ids: item.linked_requirement_ids,
      reconciliation_status: item.reconciliation_status,
      fragment_count: (item.pdd_fragments ?? []).length,
    })),
    documents: sources.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mime: doc.mime,
      kind: doc.kind,
      sizeBytes: doc.sizeBytes,
      contentSha256: doc.contentSha256,
    })),
    fragments: fragments.map((f) => ({
      fragmentId: f.fragmentId,
      documentId: f.documentId,
      kind: f.kind,
      index: f.index,
      label: f.label,
      textLength: f.text.length,
      contentSha256: f.contentSha256,
      pageStart: f.pageStart,
      pageEnd: f.pageEnd,
      sheetName: f.sheetName,
    })),
    facts: facts.map((fact) => ({
      factId: fact.factId,
      fragmentId: fact.fragmentId,
      documentId: fact.documentId,
      factType: fact.factType,
      value: fact.value,
      contentSha256: fact.contentSha256,
    })),
    candidateLinks: candidateLinks.map((link) => ({
      linkId: link.linkId,
      factId: link.factId,
      ruleId: link.ruleId,
      matchType: link.matchType,
      confidence: link.confidence,
      contentSha256: link.contentSha256,
    })),
    reconciliation: reconciliationRun
      ? {
          runId: reconciliationRun.runId,
          status: reconciliationRun.status,
          loadError: reconciliationRun.loadError,
          itemCount: reconciliationRun.items.length,
          gapCount: reconciliationRun.gaps.length,
          reconciliationFingerprint: reconciliationRun.reconciliationFingerprint,
          gaps: reconciliationRun.gaps.map((g) => ({
            ruleId: g.ruleId,
            ruleTitle: g.ruleTitle,
            sectionId: g.sectionId,
          })),
        }
      : null,
    decisions: decisionRun
      ? {
          runId: decisionRun.runId,
          decisionSetFingerprint: decisionRun.decisionSetFingerprint,
          decisions: decisionRun.decisions.map((d) => ({
            decisionId: d.decisionId,
            ruleId: d.ruleId,
            status: d.status,
            rationale: d.rationale,
            reviewerId: d.reviewerId,
            reviewedAt: d.reviewedAt,
            evidenceInventoryIds: d.evidenceInventoryIds,
            provenanceHash: d.provenanceHash,
          })),
        }
      : null,
  };

  return canonicalJsonStringify(data);
}

function buildManifest(entries: ManifestEntry[]): string {
  const manifest = {
    exportVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      path: e.path,
      contentSha256: e.contentSha256,
      sizeBytes: e.sizeBytes,
    })),
  };
  return canonicalJsonStringify(manifest);
}

export async function buildPremiumZip(input: PremiumExportInput): Promise<Buffer> {
  const zip = new JSZip();
  const entries: ManifestEntry[] = [];

  const exportJson = buildExportJson(input);
  zip.file('export.json', exportJson);
  entries.push({
    path: 'export.json',
    contentSha256: sha256(exportJson),
    sizeBytes: byteLength(exportJson),
  });

  const fragmentsDir = zip.folder('fragments');
  if (fragmentsDir) {
    for (const fragment of input.fragments) {
      const fragContent = [
        `Fragment ID: ${fragment.fragmentId}`,
        `Document ID: ${fragment.documentId}`,
        `Kind: ${fragment.kind}`,
        `Label: ${fragment.label}`,
        `Page: ${fragment.pageStart ?? ''}${fragment.pageEnd && fragment.pageEnd !== fragment.pageStart ? `-${fragment.pageEnd}` : ''}`,
        `Sheet: ${fragment.sheetName ?? ''}`,
        `Content SHA-256: ${fragment.contentSha256}`,
        '',
        fragment.text,
      ].join('\n');
      const fragPath = `fragments/${fragment.fragmentId}.txt`;
      fragmentsDir.file(`${fragment.fragmentId}.txt`, fragContent);
      entries.push({
        path: fragPath,
        contentSha256: sha256(fragContent),
        sizeBytes: byteLength(fragContent),
      });
    }
  }

  const pdf = buildPremiumPdf(input);
  const pdfContent = pdf.toString('binary');
  zip.file('reports/premium-evidence-report.pdf', pdfContent, { binary: true });
  entries.push({
    path: 'reports/premium-evidence-report.pdf',
    contentSha256: sha256(pdf.toString('utf-8')),
    sizeBytes: pdf.length,
  });

  const manifestJson = buildManifest(entries);
  zip.file('manifest.json', manifestJson);
  entries.push({
    path: 'manifest.json',
    contentSha256: sha256(manifestJson),
    sizeBytes: byteLength(manifestJson),
  });

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return zipBuffer;
}
