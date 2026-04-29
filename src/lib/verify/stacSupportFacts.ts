import type { EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { linkedRequirementIdsForEvidence } from "@/lib/evidence/inventory";

export type StacSupportFact = {
  id: string;
  datetime?: string;
  cloudCover?: number | null;
  collection?: string;
  bbox?: [number, number, number, number];
};

export type StacSupportSummary = {
  sceneCount: number;
  dateRange: { earliest: string; latest: string } | null;
  avgCloudCover: number | null;
  collections: string[];
  facts: StacSupportFact[];
};

export type StacSupportLookupStatus =
  | "requires_aoi"
  | "awaiting_search"
  | "lookup_failed"
  | "no_results"
  | "results_available";

export type StacSupportFactRecord = {
  id: string;
  datetime?: string | null;
  cloudCover?: number | null;
  collection?: string | null;
  bbox?: [number, number, number, number] | null;
  geometryType?: string | null;
  aoiRelationSummary?: string | null;
  sourceCatalogRef?: string | null;
  sourceProvider?: string | null;
  assetHref?: string | null;
  linkHref?: string | null;
  linkedAt?: string | null;
  sourcePinIds: string[];
  linkedRuleIds: string[];
};

export type StacSupportFactsState = {
  lookupStatus: StacSupportLookupStatus;
  lookupMessage: string;
  searchResultCount: number;
  linkedFacts: StacSupportFactRecord[];
  unlinkedFacts: StacSupportFactRecord[];
  availableUnlinkedIds: string[];
  runId?: string | null;
  lookupError?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const minLng = asFiniteNumber(value[0]);
  const minLat = asFiniteNumber(value[1]);
  const maxLng = asFiniteNumber(value[2]);
  const maxLat = asFiniteNumber(value[3]);
  if (minLng == null || minLat == null || maxLng == null || maxLat == null) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function uniqSorted(values: string[] | undefined | null): string[] {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function canonicalRuleKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(R-\d+(?:-\d+)*)$/i);
  return match ? match[1] : trimmed;
}

function ruleIdsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftTrimmed = left?.trim() ?? "";
  const rightTrimmed = right?.trim() ?? "";
  if (!leftTrimmed || !rightTrimmed) return false;
  if (leftTrimmed === rightTrimmed) return true;
  return canonicalRuleKey(leftTrimmed) === canonicalRuleKey(rightTrimmed);
}

function bboxIntersects(
  left: [number, number, number, number] | null | undefined,
  right: [number, number, number, number] | null | undefined,
): boolean {
  if (!left || !right) return false;
  return !(left[0] > right[2] || left[2] < right[0] || left[1] > right[3] || left[3] < right[1]);
}

function hostnameFromRef(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host || raw;
  } catch {
    return raw;
  }
}

function pickHrefRows(item: Record<string, unknown>): { assetHref: string | null; linkHref: string | null } {
  const assets = isRecord(item.assets) ? item.assets : isRecord(item.properties) && isRecord(item.properties.assets) ? item.properties.assets : null;
  const links = Array.isArray(item.links)
    ? item.links
    : isRecord(item.properties) && Array.isArray(item.properties.links)
      ? item.properties.links
      : [];

  const assetHref =
    assets
      ? Object.values(assets)
          .map((value) => (typeof value === "string" ? value : isRecord(value) ? asString(value.href) : null))
          .find((value): value is string => Boolean(value)) ?? null
      : null;

  const prioritized = ["self", "preview", "alternate", "canonical"];
  const linkRows = links
    .map((value) => {
      if (!isRecord(value)) return null;
      const href = asString(value.href);
      if (!href) return null;
      return {
        href,
        rel: asString(value.rel) ?? "link",
      };
    })
    .filter((value): value is { href: string; rel: string } => Boolean(value));

  const linkHref =
    prioritized
      .map((rel) => linkRows.find((row) => row.rel === rel)?.href ?? null)
      .find((value): value is string => Boolean(value)) ??
    linkRows[0]?.href ??
    null;

  return { assetHref, linkHref };
}

function extractLinkedInfoForItem(
  pins: EvidencePin[],
  itemId: string,
): { linkedRuleIds: string[]; sourcePinIds: string[]; linkedAt: string | null } {
  const matchingPins = pins.filter((pin) => {
    const ids = uniqSorted([pin.itemId ?? "", ...(pin.stac_item_ids ?? [])]);
    return ids.includes(itemId);
  });
  const linkedRuleIds = uniqSorted(matchingPins.flatMap((pin) => linkedRequirementIdsForEvidence(pin)));
  const sourcePinIds = uniqSorted(matchingPins.map((pin) => pin.id));
  const linkedAt = matchingPins.map((pin) => asString(pin.created_at)).find((value) => Boolean(value)) ?? null;
  return { linkedRuleIds, sourcePinIds, linkedAt };
}

function supportFactFromItem(input: {
  itemId: string;
  item: Record<string, unknown> | null;
  evidencePins: EvidencePin[];
  aoiBbox?: [number, number, number, number] | null;
  sourceRef?: string | null;
}): StacSupportFactRecord {
  const props = isRecord(input.item?.properties) ? input.item?.properties : null;
  const datetime = asString(input.item?.datetime) ?? asString(props?.datetime);
  const collection = asString(input.item?.collection) ?? asString(props?.collection);
  const cloudCover =
    asFiniteNumber(input.item?.cloud_cover) ??
    asFiniteNumber(props?.cloud_cover) ??
    asFiniteNumber(props?.["eo:cloud_cover"]);
  const bbox = parseBbox(input.item?.bbox);
  const geometryType =
    isRecord(input.item?.geometry) && typeof input.item.geometry.type === "string"
      ? input.item.geometry.type
      : null;
  const { linkedRuleIds, sourcePinIds, linkedAt } = extractLinkedInfoForItem(input.evidencePins, input.itemId);
  const { assetHref, linkHref } = pickHrefRows(input.item ?? {});
  const aoiRelationSummary = input.aoiBbox
    ? bbox
      ? bboxIntersects(input.aoiBbox, bbox)
        ? "Overlaps active AOI bbox"
        : "Returned from active AOI search; bbox does not overlap the active AOI bbox"
      : "Returned from active AOI search"
    : null;

  return {
    id: input.itemId,
    datetime,
    cloudCover: cloudCover ?? null,
    collection,
    bbox,
    geometryType,
    aoiRelationSummary,
    sourceCatalogRef: input.sourceRef ?? null,
    sourceProvider: hostnameFromRef(input.sourceRef),
    assetHref,
    linkHref,
    linkedAt,
    sourcePinIds,
    linkedRuleIds,
  };
}

function fallbackSupportFactFromPin(input: {
  pin: EvidencePin;
  itemId: string;
  sourceRef?: string | null;
}): StacSupportFactRecord {
  return {
    id: input.itemId,
    aoiRelationSummary: input.pin.aoi_fingerprint ? "Linked from prior AOI-scoped STAC search" : null,
    sourceCatalogRef: input.sourceRef ?? null,
    sourceProvider: hostnameFromRef(input.sourceRef),
    linkedAt: input.pin.created_at,
    sourcePinIds: [input.pin.id],
    linkedRuleIds: linkedRequirementIdsForEvidence(input.pin),
  };
}

/**
 * Extract STAC support facts from items for display in the review panel.
 * These are support facts, not auto-verification.
 */
export function extractStacSupportFacts(
  items: Array<{
    id: string;
    datetime?: string;
    cloud_cover?: number | null;
    collection?: string;
    bbox?: [number, number, number, number];
  }>,
  maxItems = 10,
): StacSupportSummary {
  if (!items || items.length === 0) {
    return {
      sceneCount: 0,
      dateRange: null,
      avgCloudCover: null,
      collections: [],
      facts: [],
    };
  }

  const facts: StacSupportFact[] = items.slice(0, maxItems).map((item) => ({
    id: item.id,
    datetime: item.datetime,
    cloudCover: typeof item.cloud_cover === "number" ? item.cloud_cover : null,
    collection: item.collection,
    bbox: item.bbox,
  }));

  let earliestInstant = Infinity;
  let latestInstant = -Infinity;
  let earliestStr: string | null = null;
  let latestStr: string | null = null;

  for (const item of items) {
    const dt = item.datetime;
    if (!dt) continue;
    const ms = Date.parse(dt);
    if (!Number.isFinite(ms)) continue;
    if (ms < earliestInstant) {
      earliestInstant = ms;
      earliestStr = dt;
    }
    if (ms > latestInstant) {
      latestInstant = ms;
      latestStr = dt;
    }
  }

  const dateRange = earliestStr && latestStr ? { earliest: earliestStr, latest: latestStr } : null;

  const cloudCovers = items
    .map((item) => item.cloud_cover)
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));

  const avgCloudCover = cloudCovers.length > 0
    ? Math.round((cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length) * 10) / 10
    : null;

  const collections = [...new Set(items.map((item) => item.collection).filter(Boolean))] as string[];

  return {
    sceneCount: items.length,
    dateRange,
    avgCloudCover,
    collections,
    facts,
  };
}

export function buildStacSupportFactsState(input: {
  ruleId: string | null;
  hasAoi: boolean;
  aoiBbox?: [number, number, number, number] | null;
  evidencePins: EvidencePin[];
  itemsById?: Record<string, unknown> | null;
  sourceRef?: string | null;
  runId?: string | null;
  runStatus?: VerificationRun["status"] | null;
  runSummary?: string | null;
}): StacSupportFactsState {
  const availableFacts = Object.entries(input.itemsById ?? {})
    .map(([id, item]) => supportFactFromItem({
      itemId: id,
      item: isRecord(item) ? item : null,
      evidencePins: input.evidencePins,
      aoiBbox: input.aoiBbox,
      sourceRef: input.sourceRef,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const linkedPins = input.ruleId
    ? input.evidencePins.filter((pin) =>
        linkedRequirementIdsForEvidence(pin).some((linkedRuleId) => ruleIdsMatch(linkedRuleId, input.ruleId)),
      )
    : [];

  const linkedFactsById = new Map<string, StacSupportFactRecord>();
  for (const pin of linkedPins) {
    const itemIds = uniqSorted([pin.itemId ?? "", ...(pin.stac_item_ids ?? [])]);
    for (const itemId of itemIds) {
      const current = availableFacts.find((fact) => fact.id === itemId);
      if (current) {
        linkedFactsById.set(itemId, current);
        continue;
      }
      linkedFactsById.set(itemId, fallbackSupportFactFromPin({ pin, itemId, sourceRef: input.sourceRef }));
    }
  }

  const linkedFacts = Array.from(linkedFactsById.values())
    .map((fact) => ({
      ...fact,
      linkedRuleIds: input.ruleId
        ? fact.linkedRuleIds.filter((linkedRuleId) => ruleIdsMatch(linkedRuleId, input.ruleId))
        : fact.linkedRuleIds,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const unlinkedFacts = availableFacts.filter((fact) =>
    !fact.linkedRuleIds.some((linkedRuleId) => (input.ruleId ? ruleIdsMatch(linkedRuleId, input.ruleId) : false)),
  );

  const lookupStatus: StacSupportLookupStatus = !input.hasAoi
    ? "requires_aoi"
    : input.runStatus === "error" || input.runStatus === "fail"
      ? "lookup_failed"
      : input.runStatus === "queued" || !input.runStatus
        ? "awaiting_search"
        : availableFacts.length === 0
          ? "no_results"
          : "results_available";

  const lookupMessage =
    lookupStatus === "requires_aoi"
      ? "AOI is required before STAC support facts can be used."
      : lookupStatus === "lookup_failed"
        ? "STAC support-fact lookup failed."
        : lookupStatus === "awaiting_search"
          ? "Run STAC search to populate AOI support facts."
          : lookupStatus === "no_results"
            ? "No AOI/STAC support facts were found for the active search."
            : linkedFacts.length
              ? `${linkedFacts.length} linked AOI/STAC support fact${linkedFacts.length === 1 ? "" : "s"} recorded for this rule.`
              : `${availableFacts.length} AOI/STAC support fact${availableFacts.length === 1 ? "" : "s"} available but not linked to this rule.`;

  return {
    lookupStatus,
    lookupMessage,
    searchResultCount: availableFacts.length,
    linkedFacts,
    unlinkedFacts,
    availableUnlinkedIds: unlinkedFacts.map((fact) => fact.id),
    runId: input.runId ?? null,
    lookupError: lookupStatus === "lookup_failed" ? input.runSummary?.trim() || null : null,
  };
}
