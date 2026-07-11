import {
  type PresentationGateBlock,
  type PresentationGateResult,
  type PresentationReviewState,
} from "@/lib/evidence/presentationGate";
import {
  isReportPresentationObject,
  type ReportPresentationObject,
} from "@/lib/evidence/reportPresentationObject";

export type ReadinessReportReleaseLabel =
  | "client-release-ready"
  | "internal-review-only"
  | "blocked"
  | "not assessed";

export type ReadinessReportViewModel = Readonly<{
  title: "Pre-Validation Readiness Report";
  release: Readonly<{
    state: PresentationGateResult["releaseState"] | "NOT_ASSESSED";
    label: ReadinessReportReleaseLabel;
    releaseReady: boolean;
    reasons: readonly PresentationGateBlock[];
  }>;
  rows: readonly ReportPresentationObject[];
  gate: PresentationGateResult;
}>;

function isGateResult(value: unknown): value is PresentationGateResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.presentations) || !candidate.presentations.every(isReportPresentationObject)) return false;
  if (candidate.releaseState === "PRE_VALIDATION_RELEASE_READY") {
    return candidate.releaseReady === true && !candidate.blockedBy && !candidate.warnings;
  }
  if (candidate.releaseState === "INTERNAL_REVIEW_ONLY") {
    return candidate.releaseReady === false && Array.isArray(candidate.warnings);
  }
  if (candidate.releaseState === "BLOCKED") {
    return candidate.releaseReady === false && Array.isArray(candidate.blockedBy);
  }
  return false;
}

function invalidGate(): PresentationGateResult {
  return {
    releaseReady: false,
    releaseState: "BLOCKED",
    crossRowOutcome: "NOT_EVALUATED",
    presentations: [],
    blockedBy: [{ category: "invalid_report_input", evidenceMapRowId: null, detail: "Missing or invalid Phase 7 gate result." }],
  };
}

export function createReadinessReportViewModel(input: unknown): ReadinessReportViewModel {
  const gate = isGateResult(input) ? input : invalidGate();
  const reasons = gate.releaseState === "BLOCKED" ? gate.blockedBy : gate.releaseState === "INTERNAL_REVIEW_ONLY" ? gate.warnings : [];
  const label: ReadinessReportReleaseLabel =
    gate.releaseState === "PRE_VALIDATION_RELEASE_READY"
      ? "client-release-ready"
      : gate.releaseState === "INTERNAL_REVIEW_ONLY"
        ? "internal-review-only"
        : gate.presentations.length === 0
          ? "not assessed"
          : "blocked";
  return Object.freeze({
    title: "Pre-Validation Readiness Report",
    release: Object.freeze({ state: gate.presentations.length === 0 && gate.releaseState === "BLOCKED" ? "NOT_ASSESSED" : gate.releaseState, label, releaseReady: gate.releaseReady, reasons }),
    rows: gate.presentations,
    gate,
  });
}

export type ReviewerWorkflowState = "pending review" | "approved" | "edited" | "reopened";

export type ReviewerWorkflowEvent = Readonly<{
  reviewerIdentity: string;
  timestamp: string;
  reasonOrNote: string;
  previousState: ReviewerWorkflowState | null;
  newState: ReviewerWorkflowState;
  presentationContractVersion: string;
  reviewPolicyVersion: string;
}>;

export type ReviewerWorkflowResult =
  | Readonly<{ complete: true; state: ReviewerWorkflowState; event: ReviewerWorkflowEvent }>
  | Readonly<{ complete: false; state: "incomplete"; reason: "review-history-event-required" }>;

export function validateReviewerWorkflowEvent(input: unknown): ReviewerWorkflowResult {
  if (!input || typeof input !== "object") return { complete: false, state: "incomplete", reason: "review-history-event-required" };
  const event = input as Partial<ReviewerWorkflowEvent>;
  const states: readonly ReviewerWorkflowState[] = ["pending review", "approved", "edited", "reopened"];
  if (
    typeof event.reviewerIdentity !== "string" || !event.reviewerIdentity.trim() ||
    typeof event.timestamp !== "string" || Number.isNaN(Date.parse(event.timestamp)) ||
    typeof event.reasonOrNote !== "string" || !event.reasonOrNote.trim() ||
    !states.includes(event.newState as ReviewerWorkflowState) ||
    (event.previousState !== null && !states.includes(event.previousState as ReviewerWorkflowState)) ||
    typeof event.presentationContractVersion !== "string" || !event.presentationContractVersion.trim() ||
    typeof event.reviewPolicyVersion !== "string" || !event.reviewPolicyVersion.trim()
  ) return { complete: false, state: "incomplete", reason: "review-history-event-required" };
  return { complete: true, state: event.newState as ReviewerWorkflowState, event: event as ReviewerWorkflowEvent };
}

export function reviewStateForGate(state: ReviewerWorkflowState): PresentationReviewState {
  if (state === "pending review") return "PENDING_REVIEW";
  if (state === "reopened") return "REOPENED";
  return "CURRENT";
}
