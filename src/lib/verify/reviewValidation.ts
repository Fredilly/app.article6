import type { ReviewStatus, RuleReview } from "./reviewStore";

export type ValidationError = {
  field: "rationale" | "supportReference" | "status";
  message: string;
};

export function validateReview(review: Partial<RuleReview>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!review.status) {
    errors.push({ field: "status", message: "Status is required" });
    return errors;
  }

  if (review.status === "pending") return errors;

  if (!review.rationale?.trim()) {
    errors.push({
      field: "rationale",
      message: "Rationale is required when status is not Pending",
    });
  }

  if (!review.supportReference?.trim()) {
    errors.push({
      field: "supportReference",
      message: "Support reference is required when status is not Pending",
    });
  }

  return errors;
}

export function isValid(review: Partial<RuleReview>): boolean {
  return validateReview(review).length === 0;
}

export function requiresRationale(status: ReviewStatus): boolean {
  return status !== "pending";
}

export function statusLabel(status: ReviewStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "verified":
      return "Verified";
    case "not_verified":
      return "Not Verified";
    case "needs_followup":
      return "Needs Follow-up";
  }
}

export function statusColor(status: ReviewStatus): string {
  switch (status) {
    case "pending":
      return "slate";
    case "verified":
      return "emerald";
    case "not_verified":
      return "red";
    case "needs_followup":
      return "amber";
  }
}
