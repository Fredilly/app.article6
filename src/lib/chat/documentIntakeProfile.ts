import type { EvidenceDocument } from "@/lib/quickCheck/evidence/evidenceTypes";
import { resolveEvidenceSpans } from "@/lib/quickCheck/evidence/resolveEvidenceSpans";

export type DetectedContent = {
  label: string;
  confidence: number;
  evidenceSpanIds: string[];
  pageNumbers: number[];
  reason: string;
  negativeWarning?: string;
};

export type DocumentIntakeProfile = {
  documentType: string;
  documentFamily: string;
  detectedContents: DetectedContent[];
};

/**
 * Evidence-backed intake signal.  Every positive signal includes span IDs
 * and page numbers from the resolved EvidenceDocument.  Signals without
 * evidence are omitted (not emitted with empty provenance).
 */
export type IntakeSignal = {
  label: string;
  confidence: number;
  reason: string;
  evidenceSpanIds: string[];
  pageNumbers: number[];
  negativeWarning?: string;
};

/**
 * Build a DocumentIntakeProfile from evidence-backed signals.
 *
 * Only signals with non-empty `evidenceSpanIds` are emitted.  If
 * `evidenceDocument` is provided and a signal is missing its own span
 * IDs, matching spans are derived from body-text evidence.
 */
export function buildDocumentIntakeProfile(input: {
  documentType: string;
  documentFamily: string;
  evidenceDocument?: EvidenceDocument;
  signals: IntakeSignal[];
}): DocumentIntakeProfile {
  const contents: DetectedContent[] = [];

  // Document type itself is metadata (no evidence spans), but it is
  // always emitted because it classifies the document.
  if (input.documentType) {
    contents.push({
      label: input.documentType,
      confidence: 0.95,
      evidenceSpanIds: [],
      pageNumbers: [],
      reason: `Document classified as ${input.documentType}`,
    });
  }

  for (const signal of input.signals) {
    // Derive evidence from the EvidenceDocument if the signal doesn't
    // provide its own span IDs but claims to have evidence.
    let spans = signal.evidenceSpanIds;
    let pages = signal.pageNumbers;

    if (spans.length === 0 && input.evidenceDocument) {
      const resolution = resolveEvidenceSpans(
        input.evidenceDocument.spans.map((s) => s.spanId),
        input.evidenceDocument,
      );
      // Keep only body-text spans whose normalized text contains any
      // signal-relevant keywords (from the label).
      const keywords = signal.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matching = resolution.resolved.filter((r) =>
        keywords.some((kw) => r.normalizedText.includes(kw)),
      );
      spans = matching.map((r) => r.spanId);
      pages = matching
        .map((r) => r.page)
        .filter((p): p is number => typeof p === "number");
    }

    // Only emit if there is real evidence (span IDs)
    if (spans.length === 0) continue;

    contents.push({
      label: signal.label,
      confidence: signal.confidence,
      evidenceSpanIds: spans,
      pageNumbers: Array.from(new Set(pages)).sort((a, b) => a - b),
      reason: signal.reason,
      negativeWarning: signal.negativeWarning,
    });
  }

  return {
    documentType: input.documentType,
    documentFamily: input.documentFamily,
    detectedContents: contents,
  };
}
