import { sha256Text } from '@/lib/proof/hash';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import type { ExtractedFact, CandidateLink } from './types';

type RuleSummary = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  evidenceLabels: string[];
  evidenceIds: string[];
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(/\s+/).filter((t) => t.length > 2));
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count++;
  }
  return count;
}

function linkFactsToRules(
  facts: ExtractedFact[],
  rules: RuleSummary[],
): CandidateLink[] {
  const links: CandidateLink[] = [];

  for (const fact of facts) {
    const factTokens = tokenize(fact.value + ' ' + fact.context);

    for (const rule of rules) {
      const ruleTokens = tokenize(rule.ruleTitle);
      const evidenceTokens = new Set<string>();
      for (const label of rule.evidenceLabels) {
        for (const t of tokenize(label)) evidenceTokens.add(t);
      }

      const overlapWithRule = countOverlap(factTokens, ruleTokens);
      const overlapWithEvidence = countOverlap(factTokens, evidenceTokens);

      let matchType: CandidateLink['matchType'] | null = null;
      let matchReason = '';
      let confidence = 0;

      if (rule.evidenceIds.some((eid) => fact.value.toLowerCase().includes(eid.toLowerCase()))) {
        matchType = 'exact-evidence-id';
        matchReason = `Fact references evidence ID "${rule.evidenceIds.find((e) => fact.value.toLowerCase().includes(e.toLowerCase()))}"`;
        confidence = 0.95;
      } else if (overlapWithEvidence >= 3) {
        matchType = 'evidence-label-match';
        matchReason = `Fact tokens overlap with ${overlapWithEvidence} expected evidence labels`;
        confidence = 0.7;
      } else if (overlapWithRule >= 3) {
        matchType = 'keyword-overlap';
        matchReason = `Fact tokens overlap with ${overlapWithRule} rule title keywords`;
        confidence = 0.6;
      } else if (overlapWithRule >= 2 && overlapWithEvidence >= 1) {
        matchType = 'keyword-overlap';
        matchReason = `Fact tokens overlap with rule and evidence labels`;
        confidence = 0.5;
      }

      if (matchType && confidence > 0) {
        links.push({
          linkId: `${fact.factId}__${rule.ruleId}`,
          factId: fact.factId,
          ruleId: rule.ruleId,
          ruleTitle: rule.ruleTitle,
          sectionId: rule.sectionId,
          matchType,
          matchReason,
          confidence,
          contentSha256: '',
        });
      }
    }
  }

  return links;
}

export async function generateCandidateLinks(
  facts: ExtractedFact[],
  rules: RuleSummary[],
  minConfidence = 0.3,
): Promise<CandidateLink[]> {
  const links = linkFactsToRules(facts, rules);
  const filtered = links.filter((l) => l.confidence >= minConfidence);

  for (const link of filtered) {
    link.contentSha256 = await sha256Text(canonicalJsonStringify({
      factId: link.factId,
      ruleId: link.ruleId,
      matchType: link.matchType,
      matchReason: link.matchReason,
      confidence: link.confidence,
    }));
  }

  const seen = new Set<string>();
  const deduped: CandidateLink[] = [];
  for (const link of filtered) {
    const key = `${link.factId}:${link.ruleId}:${link.matchType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(link);
  }

  deduped.sort((a, b) => b.confidence - a.confidence);
  return deduped;
}
