/**
 * Determines if a rule is eligible for STAC satellite support facts.
 * 
 * Eligibility is based on tags — no invention, no auto-verification.
 * STAC facts are support, not verdicts.
 */

const STAC_ELIGIBLE_TAGS = new Set([
  "monitoring",
  "satellite",
  "remote-sensing",
  "remote_sensing",
  "satellite-imagery",
  "satellite_imagery",
  "remote sensing",
  "satellite imagery",
]);

export function isStacEligible(tags: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((tag) => STAC_ELIGIBLE_TAGS.has(tag.toLowerCase().trim()));
}

export function stacEligibilityReason(tags: string[]): string | null {
  if (!isStacEligible(tags)) return null;
  const matched = tags.filter((tag) => STAC_ELIGIBLE_TAGS.has(tag.toLowerCase().trim()));
  return `Rule tagged "${matched.join(", ")}" — satellite evidence may support this review.`;
}
