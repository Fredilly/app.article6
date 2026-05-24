export type ReviewStatus = "pending" | "verified" | "not_verified" | "needs_followup";

export type EvidenceAttachment = {
  id: string;
  type: "url" | "file" | "reference";
  label: string;
  url?: string;
  addedAt: string;
};

export type RuleReview = {
  ruleId: string;
  methodology: string;
  version: string;
  workspaceId?: string;
  runId?: string | null;
  status: ReviewStatus;
  rationale: string;
  supportReference: string;
  evidenceLink?: string;
  evidenceAttachments: EvidenceAttachment[];
  reviewedBy: string;
  reviewedAt: string;
  updatedAt: string;
  reviewerArtifactSavedAt?: string | null;
  reviewerMinutes?: string;
  reviewerOutcomeNote?: string;
};

const STORAGE_PREFIX = "article6:reviews";
export const REVIEW_STORE_EVENT = "article6:review-store-changed";

type ReviewStoreEventDetail = {
  methodology: string;
  version: string;
  workspaceId?: string;
  ruleId?: string;
  runId?: string | null;
};

function normalizeRunId(runId?: string | null): string | null {
  const trimmed = runId?.trim();
  return trimmed ? trimmed : null;
}

function reviewRecordKey(ruleId: string, runId?: string | null): string {
  const normalizedRunId = normalizeRunId(runId);
  return normalizedRunId ? `${normalizedRunId}::${ruleId}` : ruleId;
}

function parseStoredReview(value: unknown): RuleReview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RuleReview>;
  if (
    typeof record.ruleId !== "string" ||
    typeof record.methodology !== "string" ||
    typeof record.version !== "string" ||
    typeof record.status !== "string" ||
    typeof record.rationale !== "string" ||
    typeof record.supportReference !== "string" ||
    !Array.isArray(record.evidenceAttachments) ||
    typeof record.reviewedBy !== "string" ||
    typeof record.reviewedAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    ...record,
    workspaceId: record.workspaceId?.trim() || undefined,
    runId: normalizeRunId(record.runId),
    reviewerArtifactSavedAt: record.reviewerArtifactSavedAt?.trim() || null,
    reviewerMinutes: typeof record.reviewerMinutes === "string" ? record.reviewerMinutes : "",
    reviewerOutcomeNote: typeof record.reviewerOutcomeNote === "string" ? record.reviewerOutcomeNote : "",
  } as RuleReview;
}

function loadReviewMap(methodology: string, version: string, workspaceId?: string | null): Record<string, RuleReview> {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version, workspaceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, RuleReview> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const review = parseStoredReview(value);
      if (review) next[key] = review;
    }
    return next;
  } catch {
    return {};
  }
}

function storageKey(methodology: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = workspaceId?.trim();
  if (normalizedWorkspaceId) {
    return `${STORAGE_PREFIX}:workspace:${normalizedWorkspaceId}`;
  }
  return `${STORAGE_PREFIX}:${methodology}:${version}`;
}

function emitReviewStoreEvent(detail: ReviewStoreEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REVIEW_STORE_EVENT, { detail }));
}

export function getReview(
  ruleId: string,
  methodology: string,
  version: string,
  workspaceId?: string | null,
  runId?: string | null,
): RuleReview | null {
  const all = loadReviewMap(methodology, version, workspaceId);
  const direct = all[reviewRecordKey(ruleId, runId)] ?? null;
  if (direct) return direct;
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return all[ruleId] ?? null;
  for (const review of Object.values(all)) {
    if (review.ruleId !== ruleId) continue;
    if (normalizeRunId(review.runId) === normalizedRunId) return review;
  }
  const legacy = all[ruleId] ?? null;
  return legacy && !normalizeRunId(legacy.runId) ? legacy : null;
}

export function saveReview(review: RuleReview): void {
  const workspaceId = (review as RuleReview & { workspaceId?: string | null }).workspaceId ?? null;
  const key = storageKey(review.methodology, review.version, workspaceId);
  try {
    const all = loadReviewMap(review.methodology, review.version, workspaceId);
    const normalizedRunId = normalizeRunId(review.runId);
    const storedKey = reviewRecordKey(review.ruleId, normalizedRunId);
    all[storedKey] = {
      ...review,
      workspaceId: review.workspaceId?.trim() || undefined,
      runId: normalizedRunId,
      reviewerArtifactSavedAt: review.reviewerArtifactSavedAt?.trim() || null,
      reviewerMinutes: review.reviewerMinutes ?? "",
      reviewerOutcomeNote: review.reviewerOutcomeNote ?? "",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({
      methodology: review.methodology,
      version: review.version,
      ...(workspaceId ? { workspaceId } : {}),
      ruleId: review.ruleId,
      runId: normalizedRunId,
    });
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function getAllReviews(
  methodology: string,
  version: string,
  workspaceId?: string | null,
  runId?: string | null,
): Record<string, RuleReview> {
  const all = loadReviewMap(methodology, version, workspaceId);
  const normalizedRunId = normalizeRunId(runId);
  if (!normalizedRunId) return all;
  return Object.fromEntries(
    Object.entries(all).filter(([, review]) => normalizeRunId(review.runId) === normalizedRunId),
  );
}

export function deleteReview(
  ruleId: string,
  methodology: string,
  version: string,
  workspaceId?: string | null,
  runId?: string | null,
): void {
  const key = storageKey(methodology, version, workspaceId);
  try {
    const all = loadReviewMap(methodology, version, workspaceId);
    delete all[reviewRecordKey(ruleId, runId)];
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({ methodology, version, ...(workspaceId ? { workspaceId } : {}), ruleId, runId: normalizeRunId(runId) });
  } catch {
    // ignore
  }
}

// --- Evidence attachment ---

export function addEvidenceAttachment(
  ruleId: string,
  methodology: string,
  version: string,
  attachment: Omit<EvidenceAttachment, "id" | "addedAt">,
  workspaceId?: string | null,
  runId?: string | null,
): RuleReview | null {
  const review = getReview(ruleId, methodology, version, workspaceId, runId);
  if (!review) return null;

  const full: EvidenceAttachment = {
    ...attachment,
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    addedAt: new Date().toISOString(),
  };

  review.evidenceAttachments = [...(review.evidenceAttachments ?? []), full];
  saveReview(review);
  return review;
}

export function removeEvidenceAttachment(
  ruleId: string,
  methodology: string,
  version: string,
  evidenceId: string,
  workspaceId?: string | null,
  runId?: string | null,
): RuleReview | null {
  const review = getReview(ruleId, methodology, version, workspaceId, runId);
  if (!review) return null;

  review.evidenceAttachments = (review.evidenceAttachments ?? []).filter(
    (e) => e.id !== evidenceId,
  );
  saveReview(review);
  return review;
}

// --- Review progress ---

export type ReviewProgress = {
  total: number;
  reviewed: number;
  verified: number;
  notVerified: number;
  needsFollowup: number;
  pending: number;
  percentReviewed: number;
};

export function getReviewProgress(
  methodology: string,
  version: string,
  totalRules: number,
  workspaceId?: string | null,
  runId?: string | null,
): ReviewProgress {
  const reviews = getAllReviews(methodology, version, workspaceId, runId);
  const entries = Object.values(reviews);
  const reviewed = entries.filter((r) => r.status !== "pending").length;
  const verified = entries.filter((r) => r.status === "verified").length;
  const notVerified = entries.filter((r) => r.status === "not_verified").length;
  const needsFollowup = entries.filter((r) => r.status === "needs_followup").length;
  const pending = totalRules - reviewed;

  return {
    total: totalRules,
    reviewed,
    verified,
    notVerified,
    needsFollowup,
    pending: Math.max(0, pending),
    percentReviewed: totalRules > 0 ? Math.round((reviewed / totalRules) * 100) : 0,
  };
}

// --- Finalize gate ---

export type FinalizeGate = {
  canFinalize: boolean;
  reasons: string[];
};

export function checkFinalizeGate(
  methodology: string,
  version: string,
  totalRules: number,
  options?: {
    workspaceId?: string | null;
    runId?: string | null;
    projectLinked?: boolean;
    methodologyLinked?: boolean;
  },
): FinalizeGate {
  const reviews = getAllReviews(methodology, version, options?.workspaceId, options?.runId);
  const entries = Object.values(reviews);
  const reasons: string[] = [];

  if (options?.projectLinked === false) {
    reasons.push("Review workspace is not linked to a project");
  }
  if (options?.methodologyLinked === false) {
    reasons.push("Review workspace is missing a methodology version");
  }

  // Check all rules have a non-pending review
  const completedRuleIds = new Set(
    entries.filter((review) => review.status !== "pending").map((review) => review.ruleId),
  );
  if (completedRuleIds.size < totalRules) {
    const missing = totalRules - completedRuleIds.size;
    reasons.push(`${missing} rule${missing === 1 ? "" : "s"} still pending review`);
  }

  // Check non-pending reviews have rationale + support
  for (const review of entries) {
    if (review.status === "pending") continue;
    if (!review.rationale?.trim()) {
      reasons.push(`Rule ${review.ruleId}: missing rationale`);
    }
    if (!review.supportReference?.trim()) {
      reasons.push(`Rule ${review.ruleId}: missing support reference`);
    }
  }

  return {
    canFinalize: reasons.length === 0,
    reasons,
  };
}
