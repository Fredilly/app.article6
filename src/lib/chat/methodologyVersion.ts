function normalizeDashCharacters(value: string): string {
  return value.replace(/[\u2010-\u2015]/g, "-");
}

export function normalizeDeclaredMethodologyVersion(rawVersion: string | null | undefined): string | null {
  if (typeof rawVersion !== "string") return null;

  const normalized = normalizeDashCharacters(rawVersion)
    .trim()
    .replace(/^[("'[\s]+/, "")
    .replace(/[)"'\],.;:\s]+$/g, "");

  if (!normalized) return null;

  const explicitMatch = normalized.match(/\b(?:version|ver\.?|v\.?)\s*([0-9]+(?:[.-][0-9]+)*)\b/i);
  if (explicitMatch?.[1]) {
    return `v${explicitMatch[1].replace(/-/g, ".")}`;
  }

  const bareMatch = normalized.match(/^([0-9]+(?:[.-][0-9]+)*)$/);
  if (bareMatch?.[1]) {
    return `v${bareMatch[1].replace(/-/g, ".")}`;
  }

  return null;
}
