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
  ruleId?: string;
};

function storageKey(methodology: string, version: string): string {
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
): RuleReview | null {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version));
    if (!raw) return null;
    const all: Record<string, RuleReview> = JSON.parse(raw);
    return all[ruleId] ?? null;
  } catch {
    return null;
  }
}

export function saveReview(review: RuleReview): void {
  const key = storageKey(review.methodology, review.version);
  try {
    const raw = localStorage.getItem(key);
    const all: Record<string, RuleReview> = raw ? JSON.parse(raw) : {};
    all[review.ruleId] = { 
      ...review,
      evidenceAttachments: review.evidenceAttachments ?? [],
      updatedAt: new Date().toISOString() 
    };
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({
      methodology: review.methodology,
      version: review.version,
      ruleId: review.ruleId,
    });
  } catch {
    // Storage full or unavailable
  }
}

export function getAllReviews(
  methodology: string,
  version: string,
): Record<string, RuleReview> {
  try {
    const raw = localStorage.getItem(storageKey(methodology, version));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function deleteReview(
  ruleId: string,
  methodology: string,
  version: string,
): void {
  const key = storageKey(methodology, version);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const all: Record<string, RuleReview> = JSON.parse(raw);
    delete all[ruleId];
    localStorage.setItem(key, JSON.stringify(all));
    emitReviewStoreEvent({ methodology, version, ruleId });
  } catch {
    // ignore
  }
}

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
): ReviewProgress {
  const reviews = getAllReviews(methodology, version);
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

export type FinalizeGate = {
  canFinalize: boolean;
  reasons: string[];
};

export function checkFinalizeGate(
  methodology: string,
  version: string,
  totalRules: number,
): FinalizeGate {
  const reviews = getAllReviews(methodology, version);
  const entries = Object.values(reviews);
  const reasons: string[] = [];

  const completedRuleIds = new Set(
    entries.filter((review) => review.status !== "pending").map((review) => review.ruleId),
  );
  if (completedRuleIds.size < totalRules) {
    const missing = totalRules - completedRuleIds.size;
    reasons.push(`${missing} rule${missing === 1 ? "" : "s"} still pending review`);
  }

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
