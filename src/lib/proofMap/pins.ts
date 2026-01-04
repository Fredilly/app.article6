import type { EvidencePin } from "@/lib/proofMap/types";
import { sha256Text } from "@/lib/proof/hash";

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
  aoi_fingerprint?: string | null;
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
    aoi_fingerprint: input.aoi_fingerprint ?? undefined,
    cited_ids: dedupeStrings(input.cited_ids),
    created_at,
  };
}

function canonicalPinFingerprintInput(input: { title: string; cited_ids: string[] }): string {
  const cited_ids = dedupeStrings(input.cited_ids).sort((a, b) => a.localeCompare(b));
  return JSON.stringify({ title: input.title.trim(), cited_ids });
}

export async function evidencePinFingerprint(input: { title: string; cited_ids: string[] }): Promise<string> {
  return await sha256Text(canonicalPinFingerprintInput(input));
}

export async function isDuplicateEvidencePin(
  existingPins: EvidencePin[],
  candidate: { title: string; cited_ids: string[] },
): Promise<boolean> {
  const candidateFp = await evidencePinFingerprint(candidate);
  for (const pin of existingPins ?? []) {
    const fp = await evidencePinFingerprint({ title: pin.title, cited_ids: pin.cited_ids ?? [] });
    if (fp === candidateFp) return true;
  }
  return false;
}
