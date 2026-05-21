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
  status: ReviewStatus;
  rationale: string;
  supportReference: string;
  evidenceLink?: string;
  evidenceAttachments: EvidenceAttachment[];
  reviewedBy: string;
  reviewedAt: string;
  updatedAt: string;
};

const STORAGE_PREFIX = "article6:reviews";
export const REVIEW_STORE_EVENT = "article6:review-store-changed";

type ReviewStoreEventDetail = {
  methodology: string;
  version: string;
  workspaceId?: string;
  ruleId?: string;
};

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
): RuleReview | null {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version, workspaceId));
    if (!raw) return null;
    const all: Record<string, RuleReview> = JSON.parse(raw);
    return all[ruleId] ?? null;
  } catch {
    return null;
  }
}

export function saveReview(review: RuleReview): void {
  const workspaceId = (review as RuleReview & { workspaceId?: string | null }).workspaceId ?? null;
  const key = storageKey(review.methodology, review.version, workspaceId);
  try {
    const raw = localStorage.getItem(key);
    const all: Record<string, RuleReview> = raw ? JSON.parse(raw) : {};
    all[review.ruleId] = { ...review, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({
      methodology: review.methodology,
      version: review.version,
      ...(workspaceId ? { workspaceId } : {}),
      ruleId: review.ruleId,
    });
  } catch {
    // Storage full or unavailable — fail silently
  }
}

export function getAllReviews(
  methodology: string,
  version: string,
  workspaceId?: string | null,
): Record<string, RuleReview> {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version, workspaceId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function deleteReview(
  ruleId: string,
  methodology: string,
  version: string,
  workspaceId?: string | null,
): void {
  const key = storageKey(methodology, version, workspaceId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const all: Record<string, RuleReview> = JSON.parse(raw);
    delete all[ruleId];
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({ methodology, version, ...(workspaceId ? { workspaceId } : {}), ruleId });
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
): RuleReview | null {
  const review = getReview(ruleId, methodology, version, workspaceId);
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
): RuleReview | null {
  const review = getReview(ruleId, methodology, version, workspaceId);
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
): ReviewProgress {
  const reviews = getAllReviews(methodology, version, workspaceId);
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
    projectLinked?: boolean;
    methodologyLinked?: boolean;
  },
): FinalizeGate {
  const reviews = getAllReviews(methodology, version, options?.workspaceId);
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
