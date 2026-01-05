export type DetailTab = "overview" | "assistant" | "map" | "versions" | "rules" | "sections" | "rich";

type SearchParamsLike = { get(key: string): string | null };

export type ProofMapUrlState = {
  tab?: DetailTab;
  aoiRef?: string;
  selectedStacItemId?: string;
  viewportBbox?: [number, number, number, number];
};

function asNonEmptyString(value: string | null): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : undefined;
}

export function parseDetailTab(value: string | null): DetailTab | undefined {
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
      return undefined;
  }
}

export function parseBboxParam(value: string | null): [number, number, number, number] | undefined {
  const text = (value ?? "").trim();
  if (!text) return undefined;
  const parts = text.split(",").map((v) => v.trim());
  if (parts.length !== 4) return undefined;
  const nums = parts.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  const [west, south, east, north] = nums;
  if (west < -180 || west > 180) return undefined;
  if (east < -180 || east > 180) return undefined;
  if (south < -90 || south > 90) return undefined;
  if (north < -90 || north > 90) return undefined;
  if (west > east) return undefined;
  if (south > north) return undefined;
  return [west, south, east, north];
}

export function formatBboxParam(bbox: [number, number, number, number]): string {
  const [west, south, east, north] = bbox;
  return [west, south, east, north].map((n) => (Number.isFinite(n) ? n.toFixed(6) : "")).join(",");
}

export function parseProofMapUrlState(params: SearchParamsLike): ProofMapUrlState {
  return {
    tab: parseDetailTab(params.get("tab")),
    aoiRef: asNonEmptyString(params.get("aoi")),
    selectedStacItemId: asNonEmptyString(params.get("stac")),
    viewportBbox: parseBboxParam(params.get("bbox")),
  };
}

