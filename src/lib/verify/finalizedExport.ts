import type { EvidencePin } from "@/lib/proofMap/types";
import { linkedRequirementIdsForEvidence } from "@/lib/evidence/inventory";

type SelectedStacExport = {
  id: string;
  datetime?: string;
  bbox?: unknown;
  geometry?: unknown;
  collection?: string;
  cloud_cover?: number | null;
  linked_rules: string[];
};

export type ExportChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asFiniteNumber(value: unknown): number | null | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function linkedRulesForEvidenceItem(pins: EvidencePin[], itemId: string | null | undefined): string[] {
  const selectedItemId = itemId?.trim();
  if (!selectedItemId) return [];
  return uniqSorted(
    pins.flatMap((pin) => {
      const candidateIds = [pin.itemId ?? "", ...(pin.stac_item_ids ?? [])].map((value) => value.trim()).filter(Boolean);
      return candidateIds.includes(selectedItemId) ? linkedRequirementIdsForEvidence(pin) : [];
    }),
  );
}

export function buildSelectedStacExport(input: {
  selectedStacItemId?: string | null;
  selectedStacItemRecord?: Record<string, unknown> | null;
  evidencePins: EvidencePin[];
}): SelectedStacExport | undefined {
  const selectedId = asTrimmed(input.selectedStacItemId);
  if (!selectedId) return undefined;
  const selectedItem = input.selectedStacItemRecord ?? null;
  const props = isRecord(selectedItem?.properties) ? selectedItem.properties : null;
  const datetime = asTrimmed(props?.datetime) ?? asTrimmed(selectedItem?.datetime);
  const collection = asTrimmed(props?.collection) ?? asTrimmed(selectedItem?.collection);
  const cloudCover =
    asFiniteNumber(props?.["eo:cloud_cover"]) ??
    asFiniteNumber(props?.cloud_cover) ??
    asFiniteNumber(selectedItem?.cloud_cover) ??
    null;

  return {
    id: selectedId,
    ...(datetime ? { datetime } : {}),
    ...(selectedItem?.bbox !== undefined ? { bbox: selectedItem.bbox } : {}),
    ...(selectedItem?.geometry !== undefined ? { geometry: selectedItem.geometry } : {}),
    ...(collection ? { collection } : {}),
    ...(cloudCover !== undefined ? { cloud_cover: cloudCover } : {}),
    linked_rules: linkedRulesForEvidenceItem(input.evidencePins, selectedId),
  };
}

export function prepareChecklistExport(checklist: ExportChecklistItem[]): {
  checklist?: ExportChecklistItem[];
  checklistStatus: string;
} {
  const checkedItems = checklist.filter((item) => item.checked);
  if (!checklist.length || !checkedItems.length) {
    return { checklistStatus: "unused" };
  }

  return {
    checklist: checkedItems,
    checklistStatus: `${checkedItems.length}/${checklist.length} completed`,
  };
}

export function buildFinalizedExportKpis(input: {
  stacSearchResultIds: string[];
  selectedEvidenceItemIds: string[];
  linkedRuleIds: string[];
  totalRules?: number | null;
  snapshotExportedAt?: string | null;
}): {
  stacSearchResultCount: number;
  selectedEvidenceCount: number;
  linkedRuleCount: number;
  coverage?: { numerator: number; denominator?: number };
  snapshotExportedAt?: string | null;
} {
  const denominator = typeof input.totalRules === "number" ? input.totalRules : undefined;
  return {
    stacSearchResultCount: input.stacSearchResultIds.length,
    selectedEvidenceCount: input.selectedEvidenceItemIds.length,
    linkedRuleCount: input.linkedRuleIds.length,
    coverage: {
      numerator: input.linkedRuleIds.length,
      ...(typeof denominator === "number" ? { denominator } : {}),
    },
    snapshotExportedAt: input.snapshotExportedAt ?? null,
  };
}
