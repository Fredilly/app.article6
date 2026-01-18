import { z } from "zod";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { sha256Text } from "@/lib/proof/hash";

export const EvidenceSnapshotSchema = z
  .object({
    method: z.object({
      code: z.string().min(1),
      version: z.string().min(1),
    }),
    aoi: z
      .object({
        id: z.string().min(1).optional(),
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
        geojson: z.unknown().optional(),
      })
      .optional(),
    evidence_source: z.object({
      type: z.enum(["stac_url", "upload", "unknown"]),
      ref: z.string().min(1),
      hash: z.string().min(1).optional(),
    }),
    selected: z
      .object({
        id: z.string().min(1).optional(),
        ids: z.array(z.string().min(1)).optional(),
        item: z.record(z.unknown()).optional(),
      })
      .optional(),
    app: z
      .object({
        commit: z.string().min(1).optional(),
        env: z.string().min(1).optional(),
        version: z.string().min(1).optional(),
      })
      .optional(),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          linked_rules: z.array(z.string().min(1)),
        }),
      )
      .optional(),
  })
  .strict();

export type EvidenceSnapshot = z.infer<typeof EvidenceSnapshotSchema>;

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function uniqSorted(values: string[] | undefined): string[] | undefined {
  if (!values || !values.length) return undefined;
  const set = new Set(values.map((v) => v.trim()).filter(Boolean));
  if (!set.size) return undefined;
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function normalizeItems(
  items: Array<{ id?: string | null; linked_rules?: string[] | null }> | undefined,
): Array<{ id: string; linked_rules: string[] }> | undefined {
  if (!items) return undefined;
  const normalized: Array<{ id: string; linked_rules: string[] }> = [];
  for (const item of items) {
    const id = asNonEmptyString(item.id ?? undefined);
    if (!id) continue;
    const linked_rules = uniqSorted((item.linked_rules ?? undefined) ?? undefined) ?? [];
    normalized.push({ id, linked_rules });
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id));
  return normalized;
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = stripUndefined(value as Record<string, unknown>);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out as Partial<T>;
}

export async function buildEvidenceSnapshot(input: {
  method: { code: string; version: string };
  aoi?: { id?: string | null; bbox?: [number, number, number, number] | null; geojson?: unknown };
  evidence_source: {
    type: "stac_url" | "upload" | "unknown";
    ref: string;
    hash?: string | null;
    hash_inputs?: string[] | null;
  };
  selected?: { id?: string | null; ids?: string[] | null; item?: Record<string, unknown> | null };
  app?: { commit?: string | null; env?: string | null; version?: string | null };
  items?: Array<{ id?: string | null; linked_rules?: string[] | null }> | null;
}): Promise<EvidenceSnapshot> {
  const evidenceRef = asNonEmptyString(input.evidence_source.ref) ?? "unknown";
  const evidenceType = input.evidence_source.type;

  let evidenceHash = asNonEmptyString(input.evidence_source.hash ?? undefined);
  if (!evidenceHash && evidenceType === "upload") {
    const inputs = uniqSorted((input.evidence_source.hash_inputs ?? undefined) ?? undefined);
    if (inputs && inputs.length) {
      evidenceHash = await sha256Text(JSON.stringify({ v: 1, inputs }));
    }
  }

  const selectedIds = uniqSorted((input.selected?.ids ?? undefined) ?? undefined);
  const selectedId = asNonEmptyString(input.selected?.id ?? undefined);
  const aoiGeojson = input.aoi?.geojson ?? undefined;
  const aoiId = aoiGeojson ? `aoi_${await sha256Text(canonicalJsonStringify(aoiGeojson))}` : undefined;

  const payload: EvidenceSnapshot = EvidenceSnapshotSchema.parse(
    stripUndefined({
      method: {
        code: asNonEmptyString(input.method.code) ?? "unknown",
        version: asNonEmptyString(input.method.version) ?? "unknown",
      },
      aoi: input.aoi
        ? stripUndefined({
            id: aoiId,
            bbox: input.aoi.bbox ?? undefined,
            geojson: aoiGeojson,
          })
        : undefined,
      evidence_source: stripUndefined({
        type: evidenceType,
        ref: evidenceRef,
        hash: evidenceHash,
      }),
      selected: input.selected
        ? stripUndefined({
            id: selectedId,
            ids: selectedIds,
            item: input.selected.item ?? undefined,
          })
        : undefined,
      app: input.app
        ? stripUndefined({
            commit: asNonEmptyString(input.app.commit ?? undefined),
            env: asNonEmptyString(input.app.env ?? undefined),
            version: asNonEmptyString(input.app.version ?? undefined),
          })
        : undefined,
      items: normalizeItems((input.items ?? undefined) ?? undefined),
    }),
  );

  return payload;
}
