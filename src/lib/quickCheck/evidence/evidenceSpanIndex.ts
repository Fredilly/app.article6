/**
 * EvidenceSpanIndex — typed contract for a section-aware evidence index.
 *
 * The index returns candidate evidence spans only.  It does NOT decide
 * answer status, promote answers, downgrade answers, or produce final
 * user-facing results.  The deterministic router / validator remains
 * the only component allowed to decide answered / unclear / no_evidence.
 */

// ── Candidate shape ────────────────────────────────────────────────────────

export type EvidenceSpanCandidate = {
  /** Unique identifier for the evidence span (matches EvidenceDocument.spanId). */
  evidenceSpanId: string;

  /** The raw text of the matched evidence snippet. */
  text: string;

  /** Page numbers where this evidence appears (1-based). */
  pageNumbers: number[];

  /** Ordered section path from root to this span's section. */
  sectionPath: string[];

  /** The section ID of the span (matches EvidenceSpan.sectionId). */
  sectionId?: string;

  /** The heading / title of the section containing this span, if any. */
  heading?: string;

  /** Document block type (field, paragraph, table_cell, section_heading, title, etc.). */
  blockType: string;

  /** Semantic topic tags applied by the section-topic mapper. */
  topicTags: string[];

  /** Relevance score assigned by the index (normalised, higher = better). */
  score: number;

  /** Why this candidate was returned (fact match, section match, table match, lexical match). */
  matchReason: "fact" | "section" | "table" | "lexical";
};

// ── Query input ─────────────────────────────────────────────────────────────

export type EvidenceSpanQuery = {
  /** The natural-language question or claim text. */
  claimText: string;

  /** The review area assigned by retrieveSections (baseline, monitoring, etc.). */
  reviewArea: string;

  /** User-specified or detected methodology identifier. */
  methodologyId: string;

  /** User-specified or detected methodology version. */
  methodologyVersion: string;

  /** Optional query-intent analysis result (fact_lookup, section_topic, etc.). */
  intent?: string;

  /** Optional target fact identifiers when the intent is fact_lookup. */
  targetFacts?: string[];

  /** Optional target section identifiers when the intent is section_topic. */
  targetSections?: string[];

  /** Optional target table identifiers when the intent is table_lookup. */
  targetTables?: string[];

  /** Maximum number of candidates to return (default: 5). */
  maxCandidates?: number;
};

// ── Index interface ─────────────────────────────────────────────────────────

export type EvidenceSpanIndex = {
  /**
   * Query the index and return ranked evidence span candidates.
   *
   * @returns ranked list of candidates (best first).  An empty array
   *          means no evidence was found.
   */
  query(input: EvidenceSpanQuery): EvidenceSpanCandidate[];
};
