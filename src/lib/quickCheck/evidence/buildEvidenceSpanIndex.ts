/**
 * First in-memory implementation of EvidenceSpanIndex.
 *
 * Wraps existing EvidenceDocument spans with fact-contract and
 * section-table-index metadata to provide a unified, ranked
 * evidence-candidate search.
 */

import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type {
  EvidenceSpanCandidate,
  EvidenceSpanIndex,
  EvidenceSpanQuery,
} from "@/lib/quickCheck/evidence/evidenceSpanIndex";

const DEFAULT_MAX_CANDIDATES = 5;

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function lexicalScore(span: EvidenceSpan, terms: string[]): number {
  const searchText = normalize(`${span.heading ?? ""} ${span.text}`);
  let score = 0;
  for (const term of terms) {
    const nt = normalize(term);
    if (!nt) continue;
    if (searchText.includes(nt)) {
      score += (span.heading && normalize(span.heading).includes(nt)) ? 2 : 1;
    }
  }
  return score;
}

function claimTerms(claimText: string): string[] {
  const stopWords = new Set([
    "does", "this", "that", "with", "from", "what", "when", "where", "which",
    "document", "project", "describe", "explain", "check", "review", "assess",
    "support", "include", "provide", "demonstrate", "define", "disclose",
    "address", "discuss", "mention", "outline", "summarize", "present",
    "about", "prove", "proved", "proven", "proving",
    "the", "and", "for", "are", "was", "has", "its",
  ]);
  return normalize(claimText)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopWords.has(t));
}

function toCandidate(
  span: EvidenceSpan,
  score: number,
  matchReason: EvidenceSpanCandidate["matchReason"],
  topicTags: string[] = [],
): EvidenceSpanCandidate {
  return {
    evidenceSpanId: span.spanId,
    text: span.text,
    pageNumbers: span.page != null ? [span.page] : [],
    sectionPath: span.sectionPath,
    sectionId: span.sectionId,
    heading: span.heading,
    blockType: span.blockType,
    topicTags,
    score,
    matchReason,
  };
}

// ── Fact lookup ─────────────────────────────────────────────────────────────

function factCandidates(
  contract: ProjectFactContract,
  evidenceDoc: EvidenceDocument,
  targetFacts: string[],
): EvidenceSpanCandidate[] {
  const results: EvidenceSpanCandidate[] = [];
  for (const factId of targetFacts) {
    const field = (contract as unknown as Record<string, ProjectFactField<ProjectFactValue>>)[factId];
    if (!field || !field.value) continue;
    for (const spanId of field.evidenceSpanIds) {
      const span = evidenceDoc.spans.find((s) => s.spanId === spanId);
      if (!span) continue;
      results.push(toCandidate(span, field.confidence === "high" ? 0.95 : field.confidence === "medium" ? 0.8 : 0.6, "fact"));
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, DEFAULT_MAX_CANDIDATES);
}

// ── Section lookup ──────────────────────────────────────────────────────────

function sectionCandidates(
  sectionTableIndex: SectionTableIndex,
  evidenceDoc: EvidenceDocument,
  targetSections: string[],
): EvidenceSpanCandidate[] {
  const results: EvidenceSpanCandidate[] = [];
  const targetSet = new Set(targetSections);
  for (const span of evidenceDoc.spans) {
    if (span.reliability === "excluded") continue;
    if (!span.sectionId) continue;
    // Check if any section in the span's path matches a target
    const matches = span.sectionPath.some((s) => targetSet.has(s)) || targetSet.has(span.sectionId);
    if (!matches) continue;
    const node = sectionTableIndex.sectionTree.nodesById[span.sectionId];
    const topicTags = node ? [node.heading] : [];
    results.push(toCandidate(span, 0.85, "section", topicTags));
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, DEFAULT_MAX_CANDIDATES);
}

// ── Table lookup ────────────────────────────────────────────────────────────

function tableCandidates(
  sectionTableIndex: SectionTableIndex,
  evidenceDoc: EvidenceDocument,
  targetTables: string[],
): EvidenceSpanCandidate[] {
  const results: EvidenceSpanCandidate[] = [];
  const tableIds = new Set(targetTables);
  for (const span of evidenceDoc.spans) {
    if (span.reliability === "excluded") continue;
    if (span.blockType !== "table") continue;
    if (!span.sectionId) continue;
    const tableEntry = sectionTableIndex.tableIndex.byEvidenceSpanId[span.spanId]
      ?? sectionTableIndex.tableIndex.byTableId[span.sectionId];
    if (!tableEntry || !tableIds.has(tableEntry.tableId ?? span.sectionId)) continue;
    results.push(toCandidate(span, 0.8, "table"));
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, DEFAULT_MAX_CANDIDATES);
}

// ── Lexical lookup ──────────────────────────────────────────────────────────

function lexicalCandidates(
  evidenceDoc: EvidenceDocument,
  query: EvidenceSpanQuery,
): EvidenceSpanCandidate[] {
  const terms = claimTerms(query.claimText);
  if (terms.length === 0) return [];

  const scored = evidenceDoc.spans
    .filter((s) => s.reliability !== "excluded")
    .filter((s) => s.blockType !== "footer" && s.blockType !== "header" && s.blockType !== "toc")
    .map((span) => ({ span, score: lexicalScore(span, terms) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || b.span.confidence - a.span.confidence);

  const results = scored.map((e) => toCandidate(e.span, Math.min(0.7, 0.3 + e.score * 0.1), "lexical"));
  return results.slice(0, DEFAULT_MAX_CANDIDATES);
}

// ── Build ───────────────────────────────────────────────────────────────────

export function buildEvidenceSpanIndex(input: {
  evidenceDocument: EvidenceDocument;
  projectFactContract: ProjectFactContract;
  sectionTableIndex: SectionTableIndex;
}): EvidenceSpanIndex {
  const { evidenceDocument, projectFactContract, sectionTableIndex } = input;

  return {
    query(query: EvidenceSpanQuery): EvidenceSpanCandidate[] {
      const max = query.maxCandidates ?? DEFAULT_MAX_CANDIDATES;

      // 1. Fact lookup (highest priority)
      if (query.targetFacts && query.targetFacts.length > 0) {
        return factCandidates(projectFactContract, evidenceDocument, query.targetFacts).slice(0, max);
      }

      // 2. Section topic lookup
      if (query.targetSections && query.targetSections.length > 0) {
        return sectionCandidates(sectionTableIndex, evidenceDocument, query.targetSections).slice(0, max);
      }

      // 3. Table lookup
      if (query.targetTables && query.targetTables.length > 0) {
        return tableCandidates(sectionTableIndex, evidenceDocument, query.targetTables).slice(0, max);
      }

      // 4. Lexical fallback
      return lexicalCandidates(evidenceDocument, query).slice(0, max);
    },
  };
}
