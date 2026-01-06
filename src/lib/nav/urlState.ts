export type DetailTab = "overview" | "assistant" | "map" | "versions" | "rules" | "sections" | "rich";

type SearchParamsLike = { get(key: string): string | null; toString(): string };

export function parseDetailTab(value: string | null): DetailTab | null {
  switch ((value ?? "").trim()) {
    case "overview":
    case "assistant":
    case "map":
    case "versions":
    case "rules":
    case "sections":
    case "rich":
      return value as DetailTab;
    default:
      return null;
  }
}

export function parseBboxParam(value: string | null): [number, number, number, number] | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const parts = text.split(",").map((v) => v.trim());
  if (parts.length !== 4) return null;
  const nums = parts.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = nums;
  if (west < -180 || west > 180) return null;
  if (east < -180 || east > 180) return null;
  if (south < -90 || south > 90) return null;
  if (north < -90 || north > 90) return null;
  if (west > east) return null;
  if (south > north) return null;
  return [west, south, east, north];
}

export function formatBboxParam(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  return [west, south, east, north].map((n) => (Number.isFinite(n) ? n.toFixed(6) : "")).join(",");
}

export function applyUrlUpdates(
  searchParams: SearchParamsLike,
  updates: Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(updates)) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) next.delete(key);
    else next.set(key, trimmed);
  }
  return next.toString();
}

