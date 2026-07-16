import { canonicalJsonStringify } from "@/lib/export/canonicalJson";

export const VM0007_REVIEW_CLASSIFICATIONS = ["intended_improvement", "neutral_representation_change", "regression", "requires_follow_up"] as const;
export type Vm0007ManualReviewClassification = (typeof VM0007_REVIEW_CLASSIFICATIONS)[number];

/** These fields are deterministic benchmark identity/finalization metadata, not assessment output. */
const NON_SEMANTIC_ROW_FIELDS = new Set(["auditId", "rowId", "proposalTimestamp", "finalizationState", "finalizationActorRef", "finalizedAt", "finalizationBasis", "reviewHistoryRef", "rowVersion"]);

export function substantiveVm0007ProposalRow(row: Record<string, unknown>): Record<string, unknown> {
  const projected = Object.fromEntries(Object.entries(row).filter(([key]) => !NON_SEMANTIC_ROW_FIELDS.has(key)));
  // The source-document content hash is an input identity, already frozen in the
  // extraction identity; this legacy row field was absent in the post-fix draft.
  if (projected.sourceDocument && typeof projected.sourceDocument === "object" && !Array.isArray(projected.sourceDocument)) {
    const sourceDocument = { ...(projected.sourceDocument as Record<string, unknown>) };
    delete sourceDocument.contentSha256;
    projected.sourceDocument = sourceDocument;
  }
  return projected;
}

export function substantiveDiagnosticTrace(trace: unknown): unknown {
  if (trace === null || trace === undefined) return [];
  if (!Array.isArray(trace)) return trace;
  // Diagnostic event IDs, reviewed-evidence wrappers, event notes, and event
  // ordering are benchmark wrappers. Candidate stages and cutoff are semantic.
  return trace.map((event) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) return event;
    const detail = (event as { detail?: unknown }).detail;
    const source = detail && typeof detail === "object" && !Array.isArray(detail) ? detail : event;
    const record = source as Record<string, unknown>;
    return {
      retrievalCandidates: record.retrievalCandidates ?? [],
      postFilterCandidates: record.postFilterCandidates ?? [],
      selectedCandidates: record.selectedCandidates ?? [],
      cutoffPosition: record.cutoffPosition ?? null,
    };
  });
}

export function changedVm0007RuleIds(
  baselineRows: readonly Record<string, unknown>[],
  postFixRows: readonly Record<string, unknown>[],
  expectedRuleIds: readonly string[],
  baselineTraces?: ReadonlyMap<string, unknown>,
  postFixTraces?: ReadonlyMap<string, unknown>,
): string[] {
  const baseline = new Map(baselineRows.map((row) => [String(row.stableRuleId), row]));
  const postFix = new Map(postFixRows.map((row) => [String(row.stableRuleId), row]));
  return expectedRuleIds.filter((id) => {
    const rowChanged = canonicalJsonStringify(substantiveVm0007ProposalRow(baseline.get(id)!)) !== canonicalJsonStringify(substantiveVm0007ProposalRow(postFix.get(id)!));
    const traceChanged = baselineTraces !== undefined && postFixTraces !== undefined && canonicalJsonStringify(substantiveDiagnosticTrace(baselineTraces.get(id))) !== canonicalJsonStringify(substantiveDiagnosticTrace(postFixTraces.get(id)));
    return rowChanged || traceChanged;
  }).sort();
}

export function mapDiagnosticTracesByRuleId(
  traces: readonly { stableId?: unknown }[],
  expectedRuleIds: readonly string[],
): ReadonlyMap<string, unknown> {
  const expected = new Set(expectedRuleIds);
  const map = new Map<string, unknown>();
  for (const trace of traces) {
    const id = typeof trace?.stableId === "string" ? trace.stableId.trim() : "";
    if (!id || !expected.has(id)) throw new Error(`Diagnostic trace has unknown or empty stable rule ID: ${id || "empty"}`);
    if (map.has(id)) throw new Error(`Diagnostic trace has duplicate stable rule ID: ${id}`);
    map.set(id, trace);
  }
  const missing = expectedRuleIds.filter((id) => !map.has(id));
  if (missing.length) throw new Error(`Diagnostic trace map is missing stable rule IDs: ${missing.join(", ")}`);
  return map;
}

export function removedEvidenceIsBaselineFalseSupport(
  evidenceRemoved: readonly unknown[],
  baselineFalseSupport: ReadonlySet<string>,
): boolean {
  return evidenceRemoved.length > 0 && evidenceRemoved.every((item) => baselineFalseSupport.has(canonicalJsonStringify(item)));
}

export function validateVm0007ManualReview(
  input: unknown,
  changedRuleIds: readonly string[],
): asserts input is { reviews: readonly { stableRuleId: string; classification: Vm0007ManualReviewClassification; rationale: string }[] } {
  if (!input || typeof input !== "object" || !Array.isArray((input as { reviews?: unknown }).reviews)) throw new Error("Manual review input must contain a reviews array");
  const reviews = (input as { reviews: unknown[] }).reviews;
  const ids = reviews.map((review) => String((review as { stableRuleId?: unknown })?.stableRuleId ?? "").trim());
  if (ids.some((id) => !id)) throw new Error("Manual review contains an empty stableRuleId");
  if (new Set(ids).size !== ids.length) throw new Error("Manual review contains duplicate stableRuleIds");
  const unknown = ids.filter((id) => !changedRuleIds.includes(id));
  const missing = changedRuleIds.filter((id) => !ids.includes(id));
  if (unknown.length || missing.length) throw new Error(`Manual review must exactly cover changed rules; missing=${missing.join(", ") || "none"}; extra=${unknown.join(", ") || "none"}`);
  for (const review of reviews as { stableRuleId?: unknown; classification?: unknown; rationale?: unknown }[]) {
    if (!(VM0007_REVIEW_CLASSIFICATIONS as readonly unknown[]).includes(review.classification) || typeof review.rationale !== "string" || !review.rationale.trim()) throw new Error(`Invalid manual review decision for ${String(review.stableRuleId)}`);
  }
}
