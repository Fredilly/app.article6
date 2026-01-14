import type { TraceIndex } from "@/lib/trace/traceIndex";

function normalizeEvidenceIds(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => normalizeEvidenceIds(entry));
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["evidence_ids", "evidence_id", "stac_item_ids", "item_ids", "ids"]) {
    if (record[key]) return normalizeEvidenceIds(record[key]);
  }
  return [];
}

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function buildEvidenceRuleIndex(trace: TraceIndex | null): Map<string, string[]> {
  const index = new Map<string, string[]>();
  if (!trace || typeof trace !== "object") return index;

  const ruleToEvidence = trace.rule_to_evidence ?? {};
  for (const [ruleId, raw] of Object.entries(ruleToEvidence)) {
    const evidenceIds = normalizeEvidenceIds(raw);
    for (const evidenceId of evidenceIds) {
      const list = index.get(evidenceId) ?? [];
      list.push(ruleId);
      index.set(evidenceId, list);
    }
  }

  for (const [key, list] of index.entries()) {
    index.set(key, uniqSorted(list));
  }

  return index;
}
