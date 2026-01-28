import { parseDetailTab, type DetailTab } from "@/lib/nav/urlState";

type ShareState = {
  tab?: DetailTab | null;
  view?: "map" | "list" | null;
  rule?: string | null;
  section?: string | null;
};

type SearchParamsLike = { get(key: string): string | null };

type ShareStateResult = {
  tab: string | null;
  view: string | null;
  rule: string | null;
  section: string | null;
  hash: string;
};

function normalizeValue(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeView(value?: string | null): "map" | "list" | null {
  const normalized = normalizeValue(value)?.toLowerCase() ?? null;
  if (normalized === "map" || normalized === "list") return normalized;
  return null;
}

export function encodeShareState(input: ShareState): ShareStateResult {
  const tab = normalizeValue(input.tab ?? null);
  const view = normalizeView(input.view ?? null);
  const rule = normalizeValue(input.rule ?? null);
  const section = rule ? null : normalizeValue(input.section ?? null);
  const hash = rule ? `r-${rule}` : section ? `s-${section}` : "";
  return { tab, view, rule, section, hash };
}

export function decodeShareState(searchParams: SearchParamsLike, hash?: string): ShareState {
  const rawTab = normalizeValue(searchParams.get("tab"));
  const rawMode = normalizeValue(searchParams.get("mode"));
  const tab = rawTab
    ? parseDetailTab(rawTab)
    : rawMode === "verify"
      ? "verify"
      : rawMode === "rules" || rawMode === "read"
        ? "rules"
        : null;
  const view = normalizeView(searchParams.get("view"));
  const ruleParam = normalizeValue(searchParams.get("rule"));
  const sectionParam = normalizeValue(searchParams.get("section"));
  const rawHash = normalizeValue(hash)?.replace(/^#/, "") ?? null;
  const hashRule = rawHash && rawHash.startsWith("r-") ? rawHash.slice(2) : null;
  const hashSection = rawHash && rawHash.startsWith("s-") ? rawHash.slice(2) : null;
  const rule = ruleParam ?? hashRule;
  const section = rule ? null : sectionParam ?? hashSection;
  return { tab, view, rule, section };
}
