import type { EvidencePin } from "@/lib/proofMap/types";

export function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function kindFromCitedId(id: string): "rule" | "section" | null {
  const value = id.trim();
  if (/^R-/i.test(value)) return "rule";
  if (/^S-/i.test(value)) return "section";
  return null;
}

export function buildEvidencePin(input: {
  title: string;
  cited_ids: string[];
  aoi_id?: string | null;
}): EvidencePin {
  const created_at = new Date().toISOString();
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `pin_${created_at}_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    kind: "note",
    title: input.title.trim() || "Assistant evidence",
    aoi_id: input.aoi_id ?? undefined,
    cited_ids: dedupeStrings(input.cited_ids),
    created_at,
  };
}

