import {
  deriveApplicability,
  type ApplicabilityAssessmentInput,
  type ApplicabilityResult,
} from "@/lib/evidence/applicabilityContract";
import {
  deriveConformanceConclusion,
  type ConformanceAssessmentInput,
  type ConformanceConclusionResult,
} from "@/lib/evidence/conformanceConclusionContract";
import {
  deriveDraftFinding,
  type DraftFindingAssessmentInput,
  type DraftFindingResult,
} from "@/lib/evidence/draftFindingContract";
import {
  type EvidenceMapEvidenceProvenance,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";
import {
  createReportPresentationObject,
  type ReportPresentationResult,
} from "@/lib/evidence/reportPresentationObject";
import {
  evaluatePresentationGate,
  type PresentationGateInput,
  type PresentationGateResult,
  type PresentationReviewState,
} from "@/lib/evidence/presentationGate";

export type ReviewedFixtureEvidence = Readonly<{
  evidenceId: string;
  quote: string;
  provenance: EvidenceMapEvidenceProvenance;
}>;

export type ReviewedFixtureRejectedEvidence = Readonly<{
  evidenceId: string;
  quote: string;
  rejectionReason: string;
  provenance: EvidenceMapEvidenceProvenance;
}>;

/**
 * The fixture boundary is deliberately explicit. The adapter does not infer
 * statuses, applicability, conformance, or finding classes from prose.
 */
export type ReviewedFixtureTruth = Readonly<{
  row: EvidenceMapRow;
  applicabilityAssessment: ApplicabilityAssessmentInput;
  conformanceAssessment: ConformanceAssessmentInput;
  draftFindingAssessment: DraftFindingAssessmentInput;
  reviewState?: PresentationReviewState;
}>;

export type FixturePresentationMigration = Readonly<{
  finalizedEvidenceMapRow: EvidenceMapRow;
  applicabilityInput: ApplicabilityAssessmentInput;
  applicabilityResult: ApplicabilityResult;
  conformanceInput: ConformanceAssessmentInput;
  conformanceResult: ConformanceConclusionResult;
  draftFindingInput: DraftFindingAssessmentInput;
  draftFindingResult: DraftFindingResult;
  presentationResult: ReportPresentationResult;
  gateInput: PresentationGateInput | null;
  gateResult: PresentationGateResult;
}>;

/**
 * Adapt reviewed fixture truth through the real Phase 2–7 contracts.
 *
 * This is packaging only: all assessments are supplied by the fixture and
 * every decision is made by production contract functions.
 */
export function migrateReviewedFixtureTruth(
  truth: ReviewedFixtureTruth,
): FixturePresentationMigration {
  const applicabilityResult = deriveApplicability(truth.row, truth.applicabilityAssessment);
  const conformanceResult = deriveConformanceConclusion(
    truth.row,
    applicabilityResult,
    truth.conformanceAssessment,
  );
  const draftFindingResult = deriveDraftFinding(
    truth.row,
    conformanceResult,
    truth.draftFindingAssessment,
  );
  const presentationResult = createReportPresentationObject(
    truth.row,
    applicabilityResult,
    conformanceResult,
    draftFindingResult,
  );
  const gateInput = presentationResult.ready
    ? truth.reviewState === undefined
      ? { presentation: presentationResult.presentation }
      : { presentation: presentationResult.presentation, reviewState: truth.reviewState }
    : null;
  const gateResult = gateInput === null
    ? evaluatePresentationGate(null)
    : evaluatePresentationGate(gateInput);

  return {
    finalizedEvidenceMapRow: truth.row,
    applicabilityInput: truth.applicabilityAssessment,
    applicabilityResult,
    conformanceInput: truth.conformanceAssessment,
    conformanceResult,
    draftFindingInput: truth.draftFindingAssessment,
    draftFindingResult,
    presentationResult,
    gateInput,
    gateResult,
  };
}
