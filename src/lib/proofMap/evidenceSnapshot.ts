import { z } from "zod";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { sha256Text } from "@/lib/proof/hash";
import { buildRunSummary, type RunSummary } from "@/lib/verify/runState";
import type { ReviewSummary } from "@/lib/verify/buildReviewSummary";

export const ReviewSummarySchema = z.object({
  methodCode: z.string().nullable(),
  version: z.string().nullable(),
  ruleId: z.string().nullable(),
  ruleSection: z.string().nullable(),
  ruleText: z.string().nullable(),
  selectedEvidenceId: z.string().nullable(),
  selectedEvidenceDatetime: z.string().nullable(),
  cloudCover: z.number().nullable(),
  aoiLabel: z.string().nullable(),
  reviewState: z.string().nullable(),
  generatedAt: z.string().nullable(),
  outcomeNote: z.string().nullable(),
  stacSearchResultCount: z.number().nullable(),
  linkedRuleCount: z.number().nullable(),
  selectedEvidenceLinkedRules: z.array(z.string()),
  checklistStatus: z.string().nullable(),
  reconciliationStatus: z.string().nullable(),
  reconciliationReason: z.string().nullable(),
  narrative: z.string().nullable(),
});

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
        item: z
          .object({
            id: z.string().min(1),
            datetime: z.string().optional(),
            bbox: z.unknown().optional(),
            geometry: z.unknown().optional(),
            collection: z.string().optional(),
            cloud_cover: z.number().nullable().optional(),
            linked_rules: z.array(z.string().min(1)),
          })
          .optional(),
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
    stacItemsJson: z
      .object({
        items: z.array(z.record(z.unknown())),
      })
      .optional(),
    outcome: z
      .object({
        aoi: z.object({
          hash: z.string().nullable(),
          bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
          areaKm2: z.number().nullable(),
        }),
        stac: z.object({
          query: z.object({
            source: z.string().nullable().optional(),
            collection: z.string().nullable().optional(),
            datetime: z
              .object({
                start: z.string().nullable().optional(),
                end: z.string().nullable().optional(),
              })
              .optional(),
            limit: z.number().nullable().optional(),
            filters: z.record(z.unknown()).nullable().optional(),
          }),
          itemIds: z.array(z.string()),
        }),
        linkage: z.object({
          selectedRuleId: z.string().nullable(),
          linkedRuleIds: z.array(z.string()),
        }),
        exportState: z.object({
          snapshotExportedAt: z.string().nullable(),
        }),
        provenance: z.object({
          methodCode: z.string().nullable().optional(),
          version: z.string().nullable().optional(),
          repoCommit: z.string().nullable().optional(),
          generatedAt: z.string().nullable().optional(),
          snapshotSchemaVersion: z.string().nullable().optional(),
        }),
      })
      .optional(),
    verifier: z
      .object({
        runId: z.string().min(1),
        createdAt: z.string().min(1),
        minutes: z.string(),
        outcomeNote: z.string(),
        finalizedAt: z.string().nullable(),
        finalizedState: z.enum(["draft", "finalized"]),
        delta: z.string(),
        impact: z.string(),
        checklistStatus: z.string().nullable().optional(),
        checklist: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              checked: z.boolean(),
              updatedAt: z.string().min(1),
            }),
          )
          .optional(),
        tasks: z.array(
          z.object({
            id: z.string().min(1),
            text: z.string(),
            done: z.boolean(),
            createdAt: z.string().min(1),
            updatedAt: z.string().min(1),
          }),
        ),
      })
      .optional(),
    kpis: z
      .object({
        stacSearchResultCount: z.number(),
        selectedEvidenceCount: z.number(),
        linkedRuleCount: z.number(),
        coverage: z
          .object({
            numerator: z.number(),
            denominator: z.number().optional(),
          })
          .optional(),
        snapshotExportedAt: z.string().nullable().optional(),
      })
      .optional(),
    summary: ReviewSummarySchema.optional(),
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

function normalizeSelectedItem(
  item: Record<string, unknown> | null | undefined,
): {
  id: string;
  datetime?: string;
  bbox?: unknown;
  geometry?: unknown;
  collection?: string;
  cloud_cover?: number | null;
  linked_rules: string[];
} | undefined {
  if (!item) return undefined;
  const id = asNonEmptyString(item.id);
  if (!id) return undefined;
  const props = item.properties && typeof item.properties === "object" && !Array.isArray(item.properties)
    ? (item.properties as Record<string, unknown>)
    : null;
  const linked_rules =
    uniqSorted(Array.isArray(item.linked_rules) ? item.linked_rules.filter((value): value is string => typeof value === "string") : undefined) ?? [];
  return stripUndefined({
    id,
    datetime: asNonEmptyString(item.datetime) ?? asNonEmptyString(props?.datetime),
    bbox: item.bbox,
    geometry: item.geometry,
    collection: asNonEmptyString(item.collection) ?? asNonEmptyString(props?.collection),
    cloud_cover:
      typeof item.cloud_cover === "number" && Number.isFinite(item.cloud_cover)
        ? item.cloud_cover
        : item.cloud_cover === null
          ? null
          : typeof props?.["eo:cloud_cover"] === "number" && Number.isFinite(props["eo:cloud_cover"])
            ? (props["eo:cloud_cover"] as number)
            : props?.["eo:cloud_cover"] === null
              ? null
          : undefined,
    linked_rules,
  }) as {
    id: string;
    datetime?: string;
    bbox?: unknown;
    geometry?: unknown;
    collection?: string;
    cloud_cover?: number | null;
    linked_rules: string[];
  };
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
  stacItemsJson?: { items: Array<Record<string, unknown>> } | null;
  outcome?: RunSummary | null;
    verifier?: {
    runId: string;
    createdAt: string;
    minutes: string;
    outcomeNote: string;
      finalizedAt?: string | null;
      finalizedState?: "draft" | "finalized";
      delta: string;
      impact: string;
      checklistStatus?: string | null;
      checklist?: Array<{ id: string; label: string; checked: boolean; updatedAt: string }>;
      tasks: Array<{ id: string; text: string; done: boolean; createdAt: string; updatedAt: string }>;
    } | null;
  kpis?: {
    stacSearchResultCount: number;
    selectedEvidenceCount: number;
    linkedRuleCount: number;
    coverage?: { numerator: number; denominator?: number };
    snapshotExportedAt?: string | null;
  } | null;
  summary?: ReviewSummary | null;
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
  const verifier =
    input.verifier ??
    (input.outcome?.verifier.runId && input.outcome.verifier.createdAt
      ? {
          runId: input.outcome.verifier.runId,
          createdAt: input.outcome.verifier.createdAt,
          minutes: input.outcome.verifier.minutes,
          outcomeNote: input.outcome.verifier.outcomeNote,
          finalizedAt: input.outcome.verifier.finalizedAt,
          finalizedState: input.outcome.verifier.finalizedState,
          delta: input.outcome.verifier.delta,
          impact: input.outcome.verifier.impact,
          checklistStatus: null,
          checklist: input.outcome.verifier.checklist,
          tasks: input.outcome.verifier.tasks,
        }
      : undefined);

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
          item: normalizeSelectedItem(input.selected.item ?? undefined),
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
      stacItemsJson: input.stacItemsJson ?? undefined,
      outcome: input.outcome ? buildRunSummary(input.outcome) : undefined,
      verifier,
      kpis: input.kpis ?? undefined,
      summary: input.summary ?? undefined,
    }),
  );

  return payload;
}
