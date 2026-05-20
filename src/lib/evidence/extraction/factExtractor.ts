import { sha256Text } from '@/lib/proof/hash';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import type { DocumentFragment, ExtractedFact, FactType } from './types';

const FACT_PATTERNS: Array<{ type: FactType; patterns: RegExp[] }> = [
  {
    type: 'methodology-reference',
    patterns: [
      /\b(VM\d{4}|GS-?\d{2,4}|ACM\d{4}|AMS-\d{3}[A-Z]|AR-ACM\d{4}|AR-AMS\d{4}|VMD\d{4}|VCS\s*\d{3,4})\b/gi,
      /\b(approved\s+(carbon\s+)?methodology|methodology\s+(ref|reference|id))\s*[:#]?\s*\S+/gi,
    ],
  },
  {
    type: 'parameter-value',
    patterns: [
      /\b(parameter|variable|coefficient|factor|rate|value)\s+\w+\s*[:=]\s*\d+[\.\,]?\d*/gi,
      /\b(carbon\s+stock|emission\s+factor|discount\s+rate|leakage\s+rate)\s*[:=]\s*[0-9.]+/gi,
    ],
  },
  {
    type: 'quantity',
    patterns: [
      /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(tCO2e?|tCO2|tonnes|hectares?|ha|m³|MW|kWh|MWh)\b/gi,
      /\b(total|annual|net|gross)\s+(emission[s]?|reduction[s]?|removal[s]?)\s+(of\s+)?\d/gi,
    ],
  },
  {
    type: 'date',
    patterns: [
      /\b(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/g,
      /\b(start|end|commencement|completion)\s+date\s*[:#]?\s*\S/gi,
    ],
  },
  {
    type: 'location',
    patterns: [
      /\b(lat|latitude|lon|longitude|long)\s*[:=]\s*-?\d+\.?\d*/gi,
      /\b(country|region|province|state|district|municipality)\s*[:#]?\s*\w+/gi,
    ],
  },
  {
    type: 'monitoring-period',
    patterns: [
      /\b(monitoring\s+period|crediting\s+period|verification\s+period)\s*[:#]?\s*\S/gi,
      /\b(reporting\s+period|baseline\s+period|project\s+period)\s*[:#]?\s*\S/gi,
    ],
  },
  {
    type: 'baseline-scenario',
    patterns: [
      /\b(baseline\s+scenario|reference\s+scenario|business.as.usual)\b/gi,
      /\bbaseline\s+(emissions|net\s+removals|carbon\s+stock)\b/gi,
    ],
  },
  {
    type: 'emission-reduction',
    patterns: [
      /\b(emission\s+reduction[s]?|GHG\s+reduction[s]?|carbon\s+credit[s]?)\b/gi,
      /\b(reduction|removal)\s+(of|in)\s+(GHG|CO2|carbon|emissions)\b/gi,
    ],
  },
  {
    type: 'carbon-stock',
    patterns: [
      /\b(carbon\s+stock|biomass\s+carbon|soil\s+carbon|pool)\b/gi,
      /\b(above.ground|below.ground|dead\s+wood|litter|soil\s+organic)\s+(carbon|biomass)\b/gi,
    ],
  },
  {
    type: 'project-description',
    patterns: [
      /\b(the\s+project|this\s+project|project\s+activity)\s+(aims|will|involves|concerns|is\s+located)/gi,
      /\b(project\s+description|project\s+objective|project\s+boundary|project\s+area)\b/gi,
    ],
  },
];

function extractFactsFromText(
  text: string,
  fragmentId: string,
  documentId: string,
  pageRef?: string,
  sheetRef?: string,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  for (const { type, patterns } of FACT_PATTERNS) {
    for (const regex of patterns) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const value = match[0].trim();
        if (value.length < 5) continue;
        const dedupKey = `${type}:${value}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const start = Math.max(0, match.index - 60);
        const end = Math.min(text.length, match.index + value.length + 60);
        const context = (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '');

        facts.push({
          factId: `${fragmentId}__fact_${facts.length + 1}`,
          fragmentId,
          documentId,
          factType: type,
          value,
          context,
          pageRef,
          sheetRef,
          contentSha256: '',
        });
      }
    }
  }

  return facts;
}

export async function extractFacts(fragments: DocumentFragment[]): Promise<ExtractedFact[]> {
  const allFacts: ExtractedFact[] = [];

  for (const fragment of fragments) {
    const pageRef = fragment.pageStart ? `p.${fragment.pageStart}` : undefined;
    const sheetRef = fragment.sheetName;

    const facts = extractFactsFromText(
      fragment.text,
      fragment.fragmentId,
      fragment.documentId,
      pageRef,
      sheetRef,
    );

    for (const fact of facts) {
      fact.contentSha256 = await sha256Text(canonicalJsonStringify({
        fragmentId: fact.fragmentId,
        factType: fact.factType,
        value: fact.value,
        context: fact.context,
      }));
    }

    allFacts.push(...facts);
  }

  allFacts.sort((a, b) => a.fragmentId.localeCompare(b.fragmentId) || a.factType.localeCompare(b.factType));
  return allFacts;
}
