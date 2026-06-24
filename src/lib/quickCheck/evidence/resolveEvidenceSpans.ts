import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

export type ResolvedSpan = {
  span: EvidenceSpan;
  spanId: string;
  page: number | null;
  sectionId?: string;
  heading?: string;
  headingPath: string[];
  sectionPath: string[];
  text: string;
  normalizedText: string;
  blockType: string;
  reliability: string;
  confidence: number;
  tableId?: string;
};

export type EvidenceSpanResolution = {
  resolved: ResolvedSpan[];
  unresolvedIds: string[];
  allResolved: boolean;
  warnings: string[];
};

/**
 * Canonically resolve evidenceSpanIds to EvidenceSpan objects.
 * This is the SINGLE source of truth for page/section/quote provenance
 * across the entire Quick Check pipeline.
 */
export function resolveEvidenceSpans(
  evidenceSpanIds: string[],
  document: EvidenceDocument,
): EvidenceSpanResolution {
  const spanLookup = new Map<string, EvidenceSpan>(
    document.spans.map((span) => [span.spanId, span]),
  );

  const resolved: ResolvedSpan[] = [];
  const unresolvedIds: string[] = [];
  const warnings: string[] = [];

  for (const spanId of evidenceSpanIds) {
    const span = spanLookup.get(spanId);
    if (!span) {
      unresolvedIds.push(spanId);
      warnings.push(`evidenceSpanId "${spanId}" not found in EvidenceDocument`);
      continue;
    }

    resolved.push({
      span,
      spanId: span.spanId,
      page: span.page,
      sectionId: span.sectionId,
      heading: span.heading,
      headingPath: span.headingPath,
      sectionPath: span.sectionPath,
      text: span.text,
      normalizedText: span.normalizedText,
      blockType: span.blockType,
      reliability: span.reliability,
      confidence: span.confidence,
      tableId: span.table?.tableId,
    });
  }

  if (unresolvedIds.length > 0 && resolved.length === 0) {
    warnings.push("All evidenceSpanIds failed to resolve — provenance is lost");
  }

  return {
    resolved,
    unresolvedIds,
    allResolved: unresolvedIds.length === 0,
    warnings,
  };
}

/**
 * Extract canonical pages from resolved spans.
 * Returns deduped, sorted array. Empty if no resolved spans have pages.
 */
export function pagesFromResolvedSpans(resolution: EvidenceSpanResolution): number[] {
  return Array.from(
    new Set(
      resolution.resolved
        .map((r) => r.page)
        .filter((page): page is number => typeof page === "number"),
    ),
  ).sort((a, b) => a - b);
}

/**
 * Extract canonical section paths from resolved spans.
 */
export function sectionsFromResolvedSpans(resolution: EvidenceSpanResolution): string[] {
  return Array.from(
    new Set(
      resolution.resolved
        .filter((r) => r.sectionPath.length > 0)
        .map((r) => r.sectionPath.join(" > ")),
    ),
  );
}

/**
 * Build quote text from resolved spans.
 */
export function quotesFromResolvedSpans(resolution: EvidenceSpanResolution): string[] {
  return Array.from(
    new Set(resolution.resolved.map((r) => r.text)),
  );
}
