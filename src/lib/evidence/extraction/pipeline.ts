import fs from 'node:fs';
import path from 'node:path';
import { sha256Text } from '@/lib/proof/hash';
import { loadExpectedEvidence } from '@/lib/evidence/reviewGrade';
import { extractPdfFragments } from './pdfExtractor';
import { extractWorkbookFragments } from './workbookExtractor';
import { extractFacts } from './factExtractor';
import { generateCandidateLinks } from './candidateLinker';
import {
  computeInputFingerprint,
  computeFragmentSetFingerprint,
  computeFactSetFingerprint,
  computeLinkSetFingerprint,
} from './provenance';
import type {
  SourceDocument,
  DocumentFragment,
  ExtractionRun,
  ExtractionInputFingerprint,
} from './types';

type PipelineInput = {
  projectId: string;
  documents: Array<{
    doc: SourceDocument;
    buffer: ArrayBuffer;
  }>;
  methodCode: string;
  methodVersion: string;
};

async function extractFragments(doc: SourceDocument, buffer: ArrayBuffer): Promise<DocumentFragment[]> {
  if (doc.mime === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')) {
    return extractPdfFragments(doc, buffer);
  }
  if (
    doc.mime.includes('spreadsheet') ||
    doc.mime.includes('csv') ||
    doc.fileName.toLowerCase().endsWith('.xlsx') ||
    doc.fileName.toLowerCase().endsWith('.csv')
  ) {
    return extractWorkbookFragments(doc, buffer);
  }
  return [];
}

function resolvePackDir(methodCode: string, methodVersion: string): string | null {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest', 'index.json');
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Array<Record<string, unknown>>;
    const entry = manifest.find(
      (e) => String(e.methodology ?? '') === methodCode && String(e.version ?? '') === methodVersion,
    );
    if (entry && typeof entry.path === 'string') {
      return path.join(process.cwd(), 'public', path.dirname(entry.path));
    }
  } catch {
    return null;
  }
  return null;
}

function loadRuleSummaries(methodCode: string, methodVersion: string) {
  const packDir = resolvePackDir(methodCode, methodVersion);
  if (!packDir) return [];

  const evidence = loadExpectedEvidence(packDir);
  return evidence.map((r) => ({
    ruleId: r.ruleId,
    ruleTitle: r.ruleTitle,
    sectionId: r.sectionId,
    evidenceLabels: r.expectedEvidence.map((e) => e.label),
    evidenceIds: r.expectedEvidence.map((e) => e.id),
  }));
}

export async function runExtraction(input: PipelineInput): Promise<ExtractionRun> {
  const inputFingerprintPayload: ExtractionInputFingerprint = {
    documents: input.documents.map(({ doc }) => ({
      id: doc.id,
      contentSha256: doc.contentSha256,
    })),
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
  };

  const inputFingerprint = await computeInputFingerprint(inputFingerprintPayload);

  const fragments: DocumentFragment[] = [];
  for (const { doc, buffer } of input.documents) {
    const docFragments = await extractFragments(doc, buffer);
    fragments.push(...docFragments);
  }

  const fragmentSetFingerprint = await computeFragmentSetFingerprint(fragments);

  const facts = await extractFacts(fragments);
  const factSetFingerprint = await computeFactSetFingerprint(facts);

  const rules = loadRuleSummaries(input.methodCode, input.methodVersion);
  const candidateLinks = await generateCandidateLinks(facts, rules);
  const linkSetFingerprint = await computeLinkSetFingerprint(candidateLinks);

  const runId = await sha256Text(
    `${inputFingerprint}:${fragmentSetFingerprint}:${factSetFingerprint}:${linkSetFingerprint}`,
  );

  return {
    runId,
    projectId: input.projectId,
    startedAt: new Date().toISOString(),
    inputFingerprint,
    fragments,
    fragmentSetFingerprint,
    facts,
    factSetFingerprint,
    candidateLinks,
    linkSetFingerprint,
  };
}
