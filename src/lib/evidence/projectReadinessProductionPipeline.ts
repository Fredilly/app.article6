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
  saveProjectReadinessPayload,
  type ProjectReadinessPayload,
} from "@/lib/evidence/projectReadinessPayload";

export type ProjectEvidenceMapAssessment = Readonly<{
  evidenceMapRowId: string;
  applicability: ApplicabilityAssessmentInput;
  conformance: ConformanceAssessmentInput;
  draftFinding: DraftFindingAssessmentInput;
  reviewState: PresentationReviewState;
}>;

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

/**
 * Explicit production finalization boundary for an already-reviewed project
 * Evidence Map. It never adapts Quick Check, legacy audit, or fixture data.
 */
export function finalizeProjectEvidenceMapForReadiness(input: unknown): ProjectReadinessPipelineResult {
  if (!isInput(input)) return invalid(null, [block("invalid_input", null)]);

  const rowIds = new Set<string>();
  const assessmentByRowId = new Map(input.assessments.map((assessment) => [assessment.evidenceMapRowId, assessment]));
  const blockers: ProjectReadinessPipelineBlock[] = [];
  const presentations: ReportPresentationObject[] = [];
  const gateInputs: Array<{ presentation: ReportPresentationObject; reviewState: PresentationReviewState }> = [];

  if (input.rows.length === 0 || input.assessments.length !== input.rows.length) {
    blockers.push(block("assessment_missing", null, "Every finalized Evidence Map row requires one explicit assessment."));
  }

  for (const candidate of input.rows as readonly unknown[]) {
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
    if (!assessment || assessment.evidenceMapRowId !== row.rowId || !isReviewState(assessment.reviewState)) {
      blockers.push(block("assessment_missing", row.rowId));
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
    return invalid(input.projectId, blockers.length ? blockers : [block("presentation_blocked", null)]);
  }

  const gateResult = evaluatePresentationReportGate(gateInputs);
  const payload: ProjectReadinessPayload = { projectId: input.projectId, gateResult };
  if (!saveProjectReadinessPayload(payload)) {
    return invalid(input.projectId, [block("payload_not_saved", null)]);
  }

  return { ready: true, projectId: input.projectId, payload, gateResult, presentations };
}
