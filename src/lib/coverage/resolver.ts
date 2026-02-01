export type RuleIndexEntry = {
  id: string;
  title?: string | null;
  tags?: string[] | null;
  type?: string | null;
};

export function buildRuleIndex(rules: RuleIndexEntry[]): Map<string, RuleIndexEntry> {
  const map = new Map<string, RuleIndexEntry>();
  for (const rule of rules) {
    if (!rule?.id) continue;
    map.set(rule.id, rule);
  }
  return map;
}

export async function fetchRuleIndex(methodCode: string, version: string): Promise<Map<string, RuleIndexEntry>> {
  const response = await fetch(
    `/api/methods/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}/rules`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Failed to load rules (${response.status})`);
  const payload = (await response.json()) as { rules?: unknown };
  const list = Array.isArray(payload.rules) ? payload.rules : [];
  const rules: RuleIndexEntry[] = list
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : "",
        title: typeof record.title === "string" ? record.title : null,
        tags: Array.isArray(record.tags) ? (record.tags as string[]) : null,
        type: typeof record.type === "string" ? record.type : null,
      };
    })
    .filter((rule) => rule.id);
  return buildRuleIndex(rules);
}
