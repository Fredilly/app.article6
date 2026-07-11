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

export function isPresentationGateResult(value: unknown): value is PresentationGateResult {
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
  const gate = isPresentationGateResult(input) ? input : invalidGate();
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

export type ReviewerWorkflowAction = "approve" | "edit" | "reopen";
export type ReviewerWorkflowHistory = readonly ReviewerWorkflowEvent[];
export type ReviewerWorkflowTransitionResult =
  | Readonly<{
      accepted: true;
      state: ReviewerWorkflowState;
      history: ReviewerWorkflowHistory;
    }>
  | Readonly<{
      accepted: false;
      state: "incomplete" | "invalid_transition";
      reason: "review-history-event-required" | "unsupported-transition" | "history-state-mismatch";
      history: ReviewerWorkflowHistory;
    }>;

const allowedTransitions: Readonly<Record<ReviewerWorkflowState, readonly ReviewerWorkflowState[]>> = {
  "pending review": ["approved", "edited"],
  approved: ["edited", "reopened"],
  edited: ["approved", "reopened"],
  reopened: ["edited", "approved"],
};

const actionTargets: Readonly<Record<ReviewerWorkflowState, Readonly<Record<ReviewerWorkflowAction, ReviewerWorkflowState | undefined>>>> = {
  "pending review": { approve: "approved", edit: "edited", reopen: undefined },
  approved: { approve: undefined, edit: "edited", reopen: "reopened" },
  edited: { approve: "approved", edit: undefined, reopen: "reopened" },
  reopened: { approve: "approved", edit: "edited", reopen: undefined },
};

const workflowStates: readonly ReviewerWorkflowState[] = ["pending review", "approved", "edited", "reopened"];

export function reviewerWorkflowActions(state: ReviewerWorkflowState): readonly ReviewerWorkflowAction[] {
  return Object.entries(actionTargets[state])
    .filter(([, target]) => target !== undefined)
    .map(([action]) => action as ReviewerWorkflowAction);
}

export function validateReviewerWorkflowEvent(input: unknown): ReviewerWorkflowResult {
  if (!input || typeof input !== "object") return { complete: false, state: "incomplete", reason: "review-history-event-required" };
  const event = input as Partial<ReviewerWorkflowEvent>;
  if (
    typeof event.reviewerIdentity !== "string" || !event.reviewerIdentity.trim() ||
    typeof event.timestamp !== "string" || Number.isNaN(Date.parse(event.timestamp)) ||
    typeof event.reasonOrNote !== "string" || !event.reasonOrNote.trim() ||
    !workflowStates.includes(event.newState as ReviewerWorkflowState) ||
    (event.previousState !== null && !workflowStates.includes(event.previousState as ReviewerWorkflowState)) ||
    typeof event.presentationContractVersion !== "string" || !event.presentationContractVersion.trim() ||
    typeof event.reviewPolicyVersion !== "string" || !event.reviewPolicyVersion.trim()
  ) return { complete: false, state: "incomplete", reason: "review-history-event-required" };
  return { complete: true, state: event.newState as ReviewerWorkflowState, event: event as ReviewerWorkflowEvent };
}

/** Apply one explicitly recorded reviewer transition without replacing history. */
export function transitionReviewerWorkflow(
  currentState: ReviewerWorkflowState,
  history: ReviewerWorkflowHistory | undefined,
  eventInput: unknown,
): ReviewerWorkflowTransitionResult {
  const preservedHistory = Array.isArray(history) ? history : [];
  if (!Array.isArray(history)) {
    return { accepted: false, state: "incomplete", reason: "review-history-event-required", history: preservedHistory };
  }
  if (!workflowStates.includes(currentState)) {
    return { accepted: false, state: "invalid_transition", reason: "unsupported-transition", history: preservedHistory };
  }
  let priorState: ReviewerWorkflowState | null = null;
  for (const historyEvent of preservedHistory) {
    const historyResult = validateReviewerWorkflowEvent(historyEvent);
    if (!historyResult.complete || historyResult.event.previousState === null || (priorState === null && historyResult.event.previousState !== "pending review") || (priorState !== null && historyResult.event.previousState !== priorState)) {
      return { accepted: false, state: "incomplete", reason: "review-history-event-required", history: preservedHistory };
    }
    priorState = historyResult.event.newState;
  }
  const eventResult = validateReviewerWorkflowEvent(eventInput);
  if (!eventResult.complete || eventResult.event.previousState === null) {
    return { accepted: false, state: "incomplete", reason: "review-history-event-required", history: preservedHistory };
  }
  const event = eventResult.event;
  if (event.previousState !== currentState) {
    return { accepted: false, state: "invalid_transition", reason: "history-state-mismatch", history: preservedHistory };
  }
  if (!allowedTransitions[currentState].includes(event.newState)) {
    return { accepted: false, state: "invalid_transition", reason: "unsupported-transition", history: preservedHistory };
  }
  if (preservedHistory.length > 0 && priorState !== currentState) {
    return { accepted: false, state: "invalid_transition", reason: "history-state-mismatch", history: preservedHistory };
  }
  return Object.freeze({
    accepted: true,
    state: event.newState,
    history: Object.freeze([...preservedHistory, Object.freeze({ ...event })]),
  });
}

export function reviewStateForGate(state: ReviewerWorkflowState): PresentationReviewState {
  if (state === "pending review") return "PENDING_REVIEW";
  if (state === "reopened") return "REOPENED";
  return "CURRENT";
}
