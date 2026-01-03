import type { GeoVistaArtifact } from "@/services/geovista/types";

export type GeoVistaEvidenceKind = "rule" | "section";

export function kindFromEvidenceId(id: string): GeoVistaEvidenceKind | null {
  const normalized = id.trim();
  if (!normalized) return null;
  if (/^R-/i.test(normalized)) return "rule";
  if (/^S-/i.test(normalized)) return "section";
  return null;
}

export function buildArtifactId(kind: GeoVistaEvidenceKind, evidenceId: string): string {
  return `geovista:${kind}:${evidenceId}`;
}

export function buildArtifactsFromEvidenceIds(ids: string[]): GeoVistaArtifact[] {
  const out: GeoVistaArtifact[] = [];
  const seen = new Set<string>();

  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const kind = kindFromEvidenceId(id);
    if (!kind) continue;

    out.push({
      id: buildArtifactId(kind, id),
      label: kind === "rule" ? `Rule ${id}` : `Section ${id}`,
    });
  }

  return out;
}

