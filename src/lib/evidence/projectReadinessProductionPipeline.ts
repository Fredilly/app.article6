import {
  deriveApplicability,
  type ApplicabilityAssessmentInput,
} from "@/lib/evidence/applicabilityContract";
import {
  deriveConformanceConclusion,
  type ConformanceAssessmentInput,
} from "@/lib/evidence/conformanceConclusionContract";
import {
  deriveDraftFinding,
  type DraftFindingAssessmentInput,
} from "@/lib/evidence/draftFindingContract";
import {
  validateEvidenceMapDependency,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";
import {
  evaluatePresentationReportGate,
  type PresentationGateResult,
  type PresentationReviewState,
} from "@/lib/evidence/presentationGate";
import {
  createReportPresentationObject,
  type ReportPresentationObject,
} from "@/lib/evidence/reportPresentationObject";
import {
  clearProjectReadinessPayload,
  saveProjectReadinessPayload,
  type ProjectReadinessPayload,
  type ReadinessPayloadStorageScope,
} from "@/lib/evidence/projectReadinessPayload";

export type ProjectEvidenceMapAssessment = Readonly<{
  evidenceMapRowId: string;
  applicability: ApplicabilityAssessmentInput;
  conformance: ConformanceAssessmentInput;
  draftFinding: DraftFindingAssessmentInput;
  reviewState: PresentationReviewState;
}>;

export type EvidenceMapAssessment = ProjectEvidenceMapAssessment;

export type ProjectEvidenceMapFinalizationInput = Readonly<{
  source: "PROJECT_EVIDENCE_MAP";
  projectId: string;
  rows: readonly EvidenceMapRow[];
  assessments: readonly ProjectEvidenceMapAssessment[];
}>;

export type ProjectReadinessPipelineBlock = Readonly<{
  category:
    | "invalid_input"
    | "duplicate_row_identity"
    | "assessment_missing"
    | "evidence_map_dependency_blocked"
    | "applicability_not_assessed"
    | "conformance_not_assessed"
    | "draft_finding_blocked"
    | "assessment_invalid"
    | "review_state_not_finalizable"
    | "presentation_blocked"
    | "payload_not_saved";
  evidenceMapRowId: string | null;
  detail?: string;
}>;

export type ProjectReadinessPipelineResult =
  | Readonly<{
      ready: true;
      projectId: string;
      payload: ProjectReadinessPayload;
      gateResult: PresentationGateResult;
      presentations: readonly ReportPresentationObject[];
    }>
  | Readonly<{
      ready: false;
      projectId: string | null;
      state: "NOT_ASSESSED";
      blockedBy: readonly ProjectReadinessPipelineBlock[];
    }>;

function block(
  category: ProjectReadinessPipelineBlock["category"],
  evidenceMapRowId: string | null,
  detail?: string,
): ProjectReadinessPipelineBlock {
  return detail === undefined ? { category, evidenceMapRowId } : { category, evidenceMapRowId, detail };
}

function invalid(projectId: string | null, blockedBy: readonly ProjectReadinessPipelineBlock[]): ProjectReadinessPipelineResult {
  return { ready: false, projectId, state: "NOT_ASSESSED", blockedBy };
}

function fail(projectId: string | null, blockedBy: readonly ProjectReadinessPipelineBlock[]): ProjectReadinessPipelineResult {
  if (projectId) clearProjectReadinessPayload(projectId);
  return invalid(projectId, blockedBy);
}

function failForScope(scope: ReadinessPayloadStorageScope, blockedBy: readonly ProjectReadinessPipelineBlock[]) {
  scope.clear();
  return invalid(scope.id, blockedBy);
}

export function finalizeEvidenceMapForReadiness(input: Readonly<{
  rows: readonly EvidenceMapRow[];
  assessments: readonly ProjectEvidenceMapAssessment[];
  storageScope: ReadinessPayloadStorageScope;
}>): ProjectReadinessPipelineResult {
  const scope = input.storageScope;
  const rowIds = new Set<string>();
  const blockers: ProjectReadinessPipelineBlock[] = [];
  const presentations: ReportPresentationObject[] = [];
  const gateInputs: Array<{ presentation: ReportPresentationObject; reviewState: PresentationReviewState }> = [];
  const validatedAssessments: ProjectEvidenceMapAssessment[] = [];
  for (const assessment of input.assessments) {
    if (!isProjectEvidenceMapAssessment(assessment)) {
      blockers.push(block("assessment_invalid", null));
      continue;
    }
    validatedAssessments.push(assessment);
  }
  if (blockers.length > 0) return failForScope(scope, blockers);
  const assessmentByRowId = new Map(validatedAssessments.map((assessment) => [assessment.evidenceMapRowId, assessment]));
  if (input.rows.length === 0 || input.assessments.length !== input.rows.length) {
    blockers.push(block("assessment_missing", null, "Every finalized Evidence Map row requires one explicit assessment."));
  }
  for (const candidate of input.rows) {
    if (!candidate || typeof candidate !== "object") {
      blockers.push(block("evidence_map_dependency_blocked", null));
      continue;
    }
    const row = candidate as EvidenceMapRow;
    if (rowIds.has(row.rowId)) {
      blockers.push(block("duplicate_row_identity", row.rowId));
      continue;
    }
    rowIds.add(row.rowId);
    const dependency = validateEvidenceMapDependency(row);
    if (!dependency.ready) {
      blockers.push(block("evidence_map_dependency_blocked", row.rowId, dependency.blockedBy.join(", ")));
      continue;
    }
    const assessment = assessmentByRowId.get(row.rowId);
    if (!assessment) {
      blockers.push(block("assessment_missing", row.rowId));
      continue;
    }
    if (["REOPENED", "SUPERSEDED", "STALE"].includes(assessment.reviewState)) {
      blockers.push(block("review_state_not_finalizable", row.rowId, assessment.reviewState));
      continue;
    }
    const applicability = deriveApplicability(row, assessment.applicability);
    if (applicability.applicability === "NOT_ASSESSED") {
      blockers.push(block("applicability_not_assessed", row.rowId));
      continue;
    }
    const conformance = deriveConformanceConclusion(row, applicability, assessment.conformance);
    if (conformance.conclusion === "NOT_ASSESSED") {
      blockers.push(block("conformance_not_assessed", row.rowId));
      continue;
    }
    const draftFinding = deriveDraftFinding(row, conformance, assessment.draftFinding);
    if (draftFinding.draftFindingType === null && draftFinding.blockedBy?.length) {
      blockers.push(block("draft_finding_blocked", row.rowId));
      continue;
    }
    const presentation = createReportPresentationObject(row, applicability, conformance, draftFinding);
    if (!presentation.ready) {
      blockers.push(block("presentation_blocked", row.rowId));
      continue;
    }
    presentations.push(presentation.presentation);
    gateInputs.push({ presentation: presentation.presentation, reviewState: assessment.reviewState });
  }
  if (blockers.length > 0 || presentations.length !== input.rows.length) {
    return failForScope(scope, blockers.length ? blockers : [block("presentation_blocked", null)]);
  }
  const gateResult = evaluatePresentationReportGate(gateInputs);
  if (!scope.save(gateResult)) return failForScope(scope, [block("payload_not_saved", null)]);
  return { ready: true, projectId: scope.id, payload: { projectId: scope.id, gateResult }, gateResult, presentations };
}

function isInput(value: unknown): value is ProjectEvidenceMapFinalizationInput {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProjectEvidenceMapFinalizationInput>;
  return candidate.source === "PROJECT_EVIDENCE_MAP" &&
    typeof candidate.projectId === "string" &&
    candidate.projectId.trim().length > 0 &&
    candidate.projectId === candidate.projectId.trim() &&
    Array.isArray(candidate.rows) &&
    Array.isArray(candidate.assessments);
}

function isReviewState(value: unknown): value is PresentationReviewState {
  return value === "CURRENT" || value === "PENDING_REVIEW" || value === "REOPENED" || value === "SUPERSEDED" || value === "STALE";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isProjectEvidenceMapAssessment(value: unknown): value is ProjectEvidenceMapAssessment {
  if (!isRecord(value) || typeof value.evidenceMapRowId !== "string" || !value.evidenceMapRowId || value.evidenceMapRowId.trim() !== value.evidenceMapRowId) return false;
  if (!isReviewState(value.reviewState)) return false;
  if (!isRecord(value.applicability) || !["APPLICABLE", "NOT_APPLICABLE", "NOT_EVALUATED"].includes(value.applicability.decision as string) || !isTextOrNull(value.applicability.decisionBasis)) return false;
  if (!isRecord(value.conformance)) return false;
  const conformanceValues: Record<string, readonly string[]> = {
    requirementSupport: ["SUPPORTED", "NOT_SUPPORTED", "NOT_EVALUATED"],
    searchCoverageAssessment: ["ADEQUATE", "INADEQUATE", "NOT_REQUIRED", "NOT_EVALUATED"],
    provenanceAssessment: ["COMPLETE", "INCOMPLETE", "NOT_EVALUATED"],
    versionIdentityAssessment: ["MATCHED", "NOT_REQUIRED", "MISMATCHED", "UNRESOLVED"],
    contradictionAssessment: ["NONE", "BLOCKING", "NOT_EVALUATED"],
  };
  const conformance = value.conformance as Record<string, unknown>;
  if (Object.entries(conformanceValues).some(([key, allowed]) => !allowed.includes(conformance[key] as string))) return false;
  if (!isRecord(value.draftFinding) || ![null, "NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"].includes(value.draftFinding.draftFindingType as string | null) || !isTextOrNull(value.draftFinding.findingBasis) || !isTextOrNull(value.draftFinding.reviewerAssessment)) return false;
  return true;
}

function inputProjectId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.projectId !== "string") return null;
  const projectId = value.projectId.trim();
  return projectId && projectId === value.projectId ? projectId : null;
}

/**
 * Explicit production finalization boundary for an already-reviewed project
 * Evidence Map. It never adapts Quick Check, legacy audit, or fixture data.
 */
export function finalizeProjectEvidenceMapForReadiness(input: unknown): ProjectReadinessPipelineResult {
  const projectId = inputProjectId(input);
  if (!isInput(input)) return fail(projectId, [block("invalid_input", null)]);

  return finalizeEvidenceMapForReadiness({
    rows: input.rows,
    assessments: input.assessments,
    storageScope: {
      id: input.projectId,
      save: (gateResult) => saveProjectReadinessPayload({ projectId: input.projectId, gateResult }),
      clear: () => clearProjectReadinessPayload(input.projectId),
    },
  });
}
