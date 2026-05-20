import fs from 'node:fs';
import path from 'node:path';
import { sha256Text } from '@/lib/proof/hash';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import { loadExpectedEvidence } from '@/lib/evidence/reviewGrade';
import type {
  ReconciliationInput,
  ReconciliationRun,
  ReconciliationStatus,
  ReconciliationItem,
  CoverageGap,
} from './types';

function resolvePackDir(methodCode: string, methodVersion: string): { dir: string } | { error: string } {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest', 'index.json');
  if (!fs.existsSync(manifestPath)) {
    return { error: 'Methodology manifest not found at public/manifest/index.json' };
  }

  let manifest: Array<Record<string, unknown>>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Array<Record<string, unknown>>;
  } catch {
    return { error: `Failed to parse manifest at ${manifestPath}` };
  }

  const entry = manifest.find(
    (e) => String(e.methodology ?? '') === methodCode && String(e.version ?? '') === methodVersion,
  );
  if (!entry) {
    return { error: `Methodology ${methodCode} v${methodVersion} not found in manifest` };
  }

  if (typeof entry.path !== 'string') {
    return { error: `Manifest entry for ${methodCode} v${methodVersion} has no path` };
  }

  const packDir = path.join(process.cwd(), 'public', path.dirname(entry.path));
  if (!fs.existsSync(packDir)) {
    return { error: `Pack directory not found at ${packDir}` };
  }

  return { dir: packDir };
}

function loadRuleSummaries(methodCode: string, methodVersion: string):
  { rules: Array<{ ruleId: string; ruleTitle: string; sectionId: string; evidenceLabels: string[]; evidenceIds: string[] }>; status: "ok" }
  | { status: ReconciliationStatus; loadError: string }
{
  const result = resolvePackDir(methodCode, methodVersion);
  if ('error' in result) {
    const status: ReconciliationStatus =
      result.error.includes('manifest') ? 'missing-manifest' : 'missing-pack';
    return { status, loadError: result.error };
  }

  const evidence = loadExpectedEvidence(result.dir);
  if (!evidence || evidence.length === 0) {
    return { status: 'no-rules', loadError: `No rules found in pack at ${result.dir}` };
  }

  return {
    status: 'ok',
    rules: evidence.map((r: { ruleId: string; ruleTitle: string; sectionId: string; expectedEvidence: Array<{ label: string; id: string }> }) => ({
      ruleId: r.ruleId,
      ruleTitle: r.ruleTitle,
      sectionId: r.sectionId,
      evidenceLabels: r.expectedEvidence.map((e) => e.label),
      evidenceIds: r.expectedEvidence.map((e) => e.id),
    })),
  };
}

export async function reconcileEvidence(input: ReconciliationInput): Promise<ReconciliationRun> {
  const loaded = loadRuleSummaries(input.methodCode, input.methodVersion);

  if (loaded.status !== 'ok') {
    return buildEmptyRun(input.projectId, loaded.status, loaded.loadError);
  }

  const rules = loaded.rules;

  const linkedFragmentIds = new Set<string>();
  const linkedFactIds = new Set<string>();
  const linkedRuleIds = new Set<string>();

  for (const link of input.candidateLinks) {
    const fact = input.facts.find((f) => f.factId === link.factId);
    if (fact) {
      linkedFragmentIds.add(fact.fragmentId);
      linkedFactIds.add(fact.factId);
    }
    linkedRuleIds.add(link.ruleId);
  }

  const items: ReconciliationItem[] = [];

  for (const fragment of input.fragments) {
    const isLinked = linkedFragmentIds.has(fragment.fragmentId);
    const matchingLinks = input.candidateLinks.filter(
      (l) => input.facts.find((f) => f.factId === l.factId)?.fragmentId === fragment.fragmentId,
    );
    const bestLink = matchingLinks.sort((a, b) => b.confidence - a.confidence)[0];

    items.push({
      id: `rec_${fragment.fragmentId}`,
      fragmentId: fragment.fragmentId,
      status: isLinked ? 'linked' : 'unmatched',
      ruleId: bestLink?.ruleId,
      ruleTitle: bestLink?.ruleTitle,
      sectionId: bestLink?.sectionId,
      matchType: bestLink?.matchType,
      confidence: bestLink?.confidence,
      isManualOverride: false,
      contentSha256: fragment.contentSha256,
    });
  }

  const gapRuleIds = new Set(rules.map((r) => r.ruleId));
  for (const ruleId of linkedRuleIds) {
    gapRuleIds.delete(ruleId);
  }

  const gaps: CoverageGap[] = [];
  for (const rule of rules) {
    if (!gapRuleIds.has(rule.ruleId)) continue;
    gaps.push({
      ruleId: rule.ruleId,
      ruleTitle: rule.ruleTitle,
      sectionId: rule.sectionId,
      expectedEvidenceIds: rule.evidenceIds,
      matchedEvidenceIds: [],
    });
  }

  const itemFingerprint = await computeItemFingerprint(items);
  const gapFingerprint = await computeGapFingerprint(gaps);
  const reconciliationFingerprint = await sha256Text(
    canonicalJsonStringify({
      itemFingerprint,
      gapFingerprint,
      projectId: input.projectId,
    }),
  );

  const runId = reconciliationFingerprint;

  return {
    runId,
    createdAt: new Date().toISOString(),
    projectId: input.projectId,
    status: 'complete',
    items,
    gaps,
    itemFingerprint,
    gapFingerprint,
    reconciliationFingerprint,
  };
}

async function buildEmptyRun(
  projectId: string,
  status: ReconciliationStatus,
  loadError: string,
): Promise<ReconciliationRun> {
  const emptyFingerprint = await sha256Text(canonicalJsonStringify({ status, loadError, projectId }));
  return {
    runId: emptyFingerprint,
    createdAt: new Date().toISOString(),
    projectId,
    status,
    loadError,
    items: [],
    gaps: [],
    itemFingerprint: emptyFingerprint,
    gapFingerprint: emptyFingerprint,
    reconciliationFingerprint: emptyFingerprint,
  };
}

export async function computeItemFingerprint(items: ReconciliationItem[]): Promise<string> {
  const stable = items.map((i) => ({
    id: i.id,
    status: i.status,
    ruleId: i.ruleId,
    matchType: i.matchType,
    confidence: i.confidence,
    isManualOverride: i.isManualOverride,
    contentSha256: i.contentSha256,
  }));
  stable.sort((a, b) => a.id.localeCompare(b.id));
  return sha256Text(canonicalJsonStringify(stable));
}

export async function computeGapFingerprint(gaps: CoverageGap[]): Promise<string> {
  const stable = gaps.map((g) => ({
    ruleId: g.ruleId,
    expectedEvidenceIds: [...g.expectedEvidenceIds].sort(),
    matchedEvidenceIds: [...g.matchedEvidenceIds].sort(),
  }));
  stable.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  return sha256Text(canonicalJsonStringify(stable));
}
