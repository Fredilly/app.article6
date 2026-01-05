function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value: string): string {
  const trimmed = value.trim();
  const base = trimmed.includes("#") ? trimmed.split("#")[0] : trimmed;
  return base.trim();
}

function takeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? normalizeId(item) : ""))
    .filter(Boolean);
}

function collectFromKeys(props: Record<string, unknown>, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    const list = takeStringArray(props[key]);
    if (list.length) out.push(...list);
  }
  return out;
}

function uniqSorted(values: string[]): string[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default function deriveLinksFromProperties(props: unknown): { ruleIds: string[]; sectionIds: string[] } {
  if (!isRecord(props)) return { ruleIds: [], sectionIds: [] };

  const rawRule = collectFromKeys(props, ["rule_ids", "ruleIds", "rules", "linked_rules", "linkedRuleIds"]);
  const rawSection = collectFromKeys(props, ["section_ids", "sectionIds", "sections", "linked_sections", "linkedSectionIds"]);
  const cited = collectFromKeys(props, ["cited_ids", "citedIds", "cited"]);

  const ruleIds = uniqSorted([...rawRule, ...cited].filter((id) => /^r-/i.test(id)));
  const sectionIds = uniqSorted([...rawSection, ...cited].filter((id) => /^s-/i.test(id)));

  return { ruleIds, sectionIds };
}
