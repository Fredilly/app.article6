import { parseDetailTab, type DetailTab } from "@/lib/nav/urlState";

type ShareState = {
  tab?: DetailTab | null;
  rule?: string | null;
  section?: string | null;
};

type SearchParamsLike = { get(key: string): string | null };

type ShareStateResult = {
  tab: string | null;
  rule: string | null;
  section: string | null;
  hash: string;
};

function normalizeValue(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function encodeShareState(input: ShareState): ShareStateResult {
  const tab = normalizeValue(input.tab ?? null);
  const rule = normalizeValue(input.rule ?? null);
  const section = rule ? null : normalizeValue(input.section ?? null);
  const hash = rule ? `r-${rule}` : section ? `s-${section}` : "";
  return { tab, rule, section, hash };
}

export function decodeShareState(searchParams: SearchParamsLike, hash?: string): ShareState {
  const rawTab = normalizeValue(searchParams.get("tab"));
  const tab = rawTab ? parseDetailTab(rawTab) : null;
  const ruleParam = normalizeValue(searchParams.get("rule"));
  const sectionParam = normalizeValue(searchParams.get("section"));
  const rawHash = normalizeValue(hash)?.replace(/^#/, "") ?? null;
  const hashRule = rawHash && rawHash.startsWith("r-") ? rawHash.slice(2) : null;
  const hashSection = rawHash && rawHash.startsWith("s-") ? rawHash.slice(2) : null;
  const rule = ruleParam ?? hashRule;
  const section = rule ? null : sectionParam ?? hashSection;
  return { tab, rule, section };
}
