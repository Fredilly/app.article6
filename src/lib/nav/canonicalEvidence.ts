function normalizeView(value: string | null): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (trimmed === "map" || trimmed === "list") return trimmed;
  return null;
}

export function canonicalEvidencePath(pathname: string, searchParams: URLSearchParams): string | null {
  if (!searchParams.toString()) return null;

  const next = new URLSearchParams();
  const rawMode = (searchParams.get("mode") ?? "").trim();
  if (rawMode === "verify") {
    next.set("mode", "verify");
    const view = normalizeView(searchParams.get("view")) ?? "list";
    next.set("view", view);
  } else {
    const mode = normalizeView(searchParams.get("mode")) ?? normalizeView(searchParams.get("tab"));
    if (mode) next.set("mode", mode);
  }

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
