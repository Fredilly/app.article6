function normalizeMode(value: string | null): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed === "map" || trimmed === "list") return trimmed;
  return null;
}

export function canonicalEvidencePath(pathname: string, searchParams: URLSearchParams): string | null {
  if (!searchParams.toString()) return null;

  const next = new URLSearchParams();
  const mode = normalizeMode(searchParams.get("mode")) ?? normalizeMode(searchParams.get("tab"));
  if (mode) next.set("mode", mode);

  for (const key of ["aoi", "rule", "evidence"]) {
    const value = searchParams.get(key);
    if (value && value.trim()) next.set(key, value.trim());
  }

  const nextQuery = next.toString();
  const currentQuery = searchParams.toString();
  if (!nextQuery) return pathname;
  if (nextQuery === currentQuery) return null;
  return `${pathname}?${nextQuery}`;
}
