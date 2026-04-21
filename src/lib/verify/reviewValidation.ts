import { RuleReview } from './reviewStore';

export function validateReview(review: Partial<RuleReview>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (review.status && review.status !== 'pending') {
    if (!review.rationale || review.rationale.trim().length === 0) {
      errors.push('Rationale is required for verified, not verified, or follow-up status.');
    }
    if (!review.supportReference || review.supportReference.trim().length === 0) {
      errors.push('Support reference is required for verified, not verified, or follow-up status.');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function statusLabel(status: RuleReview['status']): string {
  switch (status) {
    case 'verified': return 'Verified';
    case 'not_verified': return 'Not Verified';
    case 'needs_followup': return 'Needs Follow-up';
    case 'pending': return 'Pending';
    default: return status;
  }
}
