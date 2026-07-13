import type {
  ReviewedEvidenceMapRow,
  ReviewedEvidenceMapSnapshot,
  ReviewedEvidenceRecord,
  ReviewedEvidenceState,
  ReviewedOutcome,
} from "./reviewedEvidenceMapTypes";

type UnknownRecord = Record<string, unknown>;
const evidenceStates = new Set<ReviewedEvidenceState>([
  "FOUND",
  "UNCLEAR",
  "MISSING",
  "N/A",
]);
const reviewerOutcomes = new Set<ReviewedOutcome>([
  "CONFORMS",
  "ACTION_REQUIRED",
  "NOT_APPLICABLE",
]);

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function evidenceRecord(value: unknown): ReviewedEvidenceRecord | null {
  const outer = record(value);
  const source = record(outer?.evidence) ?? outer;
  const provenance = record(source?.provenance);
  const quote = text(source?.quote);
  const spanId = text(source?.spanId) ?? text(provenance?.spanId);
  const docId = text(provenance?.docId);
  if (!source || !provenance || !quote || !spanId || !docId) return null;
  const pageValue =
    typeof source.page === "number"
      ? source.page
      : typeof provenance.page === "number"
        ? provenance.page
        : null;
  const section = text(source.section) ?? text(provenance.sectionHeading);
  return {
    quote,
    page: pageValue,
    section,
    spanId,
    provenance: {
      docId,
      page: typeof provenance.page === "number" ? provenance.page : pageValue,
      sectionPath: Array.isArray(provenance.sectionPath)
        ? provenance.sectionPath.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      spanId,
      sectionHeading: text(provenance.sectionHeading) ?? section,
      sourceType: text(provenance.sourceType),
    },
    ...(text(source.rejectionReason) || text(outer?.rejectionReason)
      ? {
          rejectionReason:
            text(source.rejectionReason) ?? text(outer?.rejectionReason)!,
        }
      : {}),
  };
}

function reviewedRow(
  value: unknown,
  auditId: string,
): ReviewedEvidenceMapRow | null {
  const source = record(value);
  const stableRuleId = text(source?.ruleId);
  const state = source?.finalEvidenceState;
  const outcome = source?.reviewerOutcome;
  if (
    !source ||
    source.reviewStatus !== "REVIEWED" ||
    !stableRuleId ||
    !evidenceStates.has(state as ReviewedEvidenceState) ||
    !reviewerOutcomes.has(outcome as ReviewedOutcome)
  )
    return null;
  const reviewerEvidence = Array.isArray(source.acceptedEvidence)
    ? source.acceptedEvidence.map(evidenceRecord)
    : [];
  const rejectedEvidence = Array.isArray(source.rejectedEvidence)
    ? source.rejectedEvidence.map(evidenceRecord)
    : [];
  if (
    reviewerEvidence.some((item) => item === null) ||
    rejectedEvidence.some((item) => item === null)
  )
    return null;
  return {
    rowId: `${auditId}:${stableRuleId}`,
    stableRuleId,
    ruleReference: text(source.ruleReference) ?? stableRuleId,
    requirementText: text(source.requirement) ?? stableRuleId,
    finalEvidenceState: state as ReviewedEvidenceState,
    reviewerOutcome: outcome as ReviewedOutcome,
    reviewerEvidence: reviewerEvidence as ReviewedEvidenceRecord[],
    rejectedEvidence: rejectedEvidence as ReviewedEvidenceRecord[],
    draftFindingCandidate: text(source.draftFindingCandidate),
    contradictionState: text(source.contradictionState) ?? "NOT_RECORDED",
    clientAction: text(source.clientAction) ?? "",
  };
}

export function adaptReviewedEvidenceMap(input: {
  reviewed: unknown;
  draft: unknown;
  metadata: unknown;
}): ReviewedEvidenceMapSnapshot | null {
  const reviewed = record(input.reviewed);
  const draft = record(input.draft);
  const metadata = record(input.metadata);
  const draftRows = Array.isArray(draft?.rows) ? draft.rows : [];
  const firstDraftRow = record(draftRows[0]);
  const canonicalAuditId = text(firstDraftRow?.auditId);
  const stableProjectId = text(reviewed?.stableProjectId);
  const sourceDocument = record(metadata?.sourceDocument);
  const sourceHash =
    text(sourceDocument?.contentSha256) ?? text(metadata?.sourcePdfSha256);
  const rawRows = Array.isArray(reviewed?.rows) ? reviewed.rows : [];
  if (
    !canonicalAuditId ||
    !stableProjectId ||
    stableProjectId !== text(metadata?.stableProjectId) ||
    !sourceHash ||
    !rawRows.length
  )
    return null;
  const rows = rawRows.map((row) => reviewedRow(row, canonicalAuditId));
  if (
    rows.some((row) => row === null) ||
    new Set(rows.map((row) => row?.stableRuleId)).size !== rows.length
  )
    return null;
  return {
    canonicalAuditId,
    stableProjectId,
    sourceDocument: {
      documentId: text(sourceDocument?.documentId) ?? "reviewed-snapshot",
      documentName:
        text(sourceDocument?.documentName) ?? text(metadata?.sourcePdfName),
      contentSha256: sourceHash,
    },
    methodologyId: "VM0007",
    methodologyVersion: "v1.8",
    rows: rows as ReviewedEvidenceMapRow[],
    readOnly: true,
  };
}
