import { buildEvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import type { RunSummary } from "@/lib/verify/runState";

export async function buildOutcomeSnapshot(input: {
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
    delta: string;
    impact: string;
    checklist: Array<{ id: string; label: string; checked: boolean; updatedAt: string }>;
    tasks: Array<{ id: string; text: string; done: boolean; createdAt: string; updatedAt: string }>;
  } | null;
  kpis?: {
    itemsCount: number;
    linkedRulesCount: number;
    coverage?: { numerator: number; denominator?: number };
    snapshotExportedAt?: string | null;
  } | null;
}) {
  return buildEvidenceSnapshot({
    method: input.method,
    aoi: input.aoi,
    evidence_source: input.evidence_source,
    selected: input.selected,
    app: input.app,
    items: input.items,
    stacItemsJson: input.stacItemsJson,
    outcome: input.outcome ?? undefined,
    verifier: input.verifier ?? undefined,
    kpis: input.kpis ?? undefined,
  });
}
