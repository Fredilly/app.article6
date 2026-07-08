function normalizeDashCharacters(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, "-");
}

const METHODOLOGY_VERSION_CONTEXT_RE =
  /\b(?:VM\d{4}|VMD\d{4}|ACM\d{4}|AM\d{4}|AMS-[A-Z0-9.]+|AR-[A-Z0-9.-]+|GS-[A-Z0-9.-]+|VT\d{4}|methodology|framework|redd(?:\+\s*|[-\s]+)?mf)\b/i;

function canonicalizeVersionSegments(rawSegments: string[]): string | null {
  const normalizedSegments: string[] = [];

  for (const rawSegment of rawSegments) {
    const segment = rawSegment.trim();
    if (!segment || !/^\d+$/.test(segment)) {
      return null;
    }
    normalizedSegments.push(String(Number.parseInt(segment, 10)));
  }

  if (normalizedSegments.length === 0) {
    return null;
  }

  if (normalizedSegments.length === 1) {
    normalizedSegments.push("0");
  }

  return `v${normalizedSegments.join(".")}`;
}

export function normalizeMethodologyVersion(rawVersion: string | null | undefined): string | null {
  if (typeof rawVersion !== "string") return null;

  const normalized = normalizeDashCharacters(rawVersion)
    .trim()
    .replace(/^[("'[\s]+/, "")
    .replace(/[)"'\],.;:\s]+$/g, "");

  if (!normalized) return null;

  const explicitMatch = normalized.match(/\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+)*)\b/i);
  if (explicitMatch?.[1]) {
    return canonicalizeVersionSegments(explicitMatch[1].split(/[.-]/));
  }

  const bareMatch = normalized.match(/^([0-9]+(?:[.-][0-9]+)*)$/);
  if (bareMatch?.[1]) {
    return canonicalizeVersionSegments(bareMatch[1].split(/[.-]/));
  }

  const contextualTrailingMatch = normalized.match(/([0-9]+(?:[.-][0-9]+)+)\s*$/);
  if (contextualTrailingMatch?.[1] && METHODOLOGY_VERSION_CONTEXT_RE.test(normalized)) {
    return canonicalizeVersionSegments(contextualTrailingMatch[1].split(/[.-]/));
  }

  return null;
}

export const normalizeDeclaredMethodologyVersion = normalizeMethodologyVersion;
