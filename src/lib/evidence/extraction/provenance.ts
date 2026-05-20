import { sha256Text } from '@/lib/proof/hash';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import type { ExtractionInputFingerprint, DocumentFragment, ExtractedFact, CandidateLink } from './types';

export async function computeInputFingerprint(input: ExtractionInputFingerprint): Promise<string> {
  return sha256Text(canonicalJsonStringify(input));
}

export async function computeFragmentSetFingerprint(fragments: DocumentFragment[]): Promise<string> {
  const stable = fragments.map((f) => ({
    index: f.index,
    kind: f.kind,
    contentSha256: f.contentSha256,
    pageStart: f.pageStart,
    pageEnd: f.pageEnd,
    sheetName: f.sheetName,
    sheetIndex: f.sheetIndex,
  }));
  stable.sort((a, b) => a.index - b.index);
  return sha256Text(canonicalJsonStringify(stable));
}

export async function computeFactSetFingerprint(facts: ExtractedFact[]): Promise<string> {
  const stable = facts.map((f) => ({
    fragmentId: f.fragmentId,
    factType: f.factType,
    contentSha256: f.contentSha256,
  }));
  stable.sort((a, b) => a.fragmentId.localeCompare(b.fragmentId));
  return sha256Text(canonicalJsonStringify(stable));
}

export async function computeLinkSetFingerprint(links: CandidateLink[]): Promise<string> {
  const stable = links.map((l) => ({
    factId: l.factId,
    ruleId: l.ruleId,
    matchType: l.matchType,
    contentSha256: l.contentSha256,
  }));
  stable.sort((a, b) => a.factId.localeCompare(b.factId) || a.ruleId.localeCompare(b.ruleId));
  return sha256Text(canonicalJsonStringify(stable));
}
