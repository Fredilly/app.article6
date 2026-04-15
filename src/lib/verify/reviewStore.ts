export type ReviewStatus = "pending" | "verified" | "not_verified" | "needs_followup";

export type RuleReview = {
  ruleId: string;
  methodology: string;
  version: string;
  status: ReviewStatus;
  rationale: string;
  supportReference: string;
  evidenceLink?: string;
  reviewedBy: string;
  reviewedAt: string;
  updatedAt: string;
};

const STORAGE_PREFIX = "article6:reviews";

function storageKey(methodology: string, version: string): string {
  return `${STORAGE_PREFIX}:${methodology}:${version}`;
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
    all[review.ruleId] = { ...review, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // Storage full or unavailable — fail silently
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
  } catch {
    // ignore
  }
}
