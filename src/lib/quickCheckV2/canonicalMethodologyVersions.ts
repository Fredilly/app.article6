const CANONICAL_METHODOLOGY_VERSION_HINTS: Record<string, string> = {
  VM0007: "v1.8",
};

export function lookupCanonicalMethodologyVersion(methodologyId: string): string | null {
  return CANONICAL_METHODOLOGY_VERSION_HINTS[methodologyId.trim().toUpperCase()] ?? null;
}
