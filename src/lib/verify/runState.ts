export type RunSummary = {
  aoi: {
    hash: string | null;
    bbox: [number, number, number, number] | null;
    areaKm2: number | null;
  };
  stac: {
    query: {
      source?: string | null;
      collection?: string | null;
      datetime?: { start?: string | null; end?: string | null };
      limit?: number | null;
      filters?: Record<string, unknown> | null;
    };
    itemIds: string[];
  };
  linkage: {
    linkedRuleIds: string[];
  };
  exportState: {
    snapshotExportedAt: string | null;
  };
  provenance: {
    methodCode?: string | null;
    version?: string | null;
    repoCommit?: string | null;
    generatedAt?: string | null;
    snapshotSchemaVersion?: string | null;
  };
};

export const SNAPSHOT_SCHEMA_VERSION = "evidence-snapshot/v2";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function uniqSorted(values: string[] | undefined | null): string[] {
  if (!values?.length) return [];
  const set = new Set(values.map((value) => value.trim()).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function addLinkedRuleId(current: string[] | undefined | null, ruleId: string | null | undefined): string[] {
  if (!ruleId) return uniqSorted(current);
  return uniqSorted([...(current ?? []), ruleId]);
}

export function parseLinkedRuleId(input: { ruleParam?: string | null; hash?: string | null }): string | null {
  const ruleParam = (input.ruleParam ?? "").trim();
  if (ruleParam) return ruleParam;
  const rawHash = (input.hash ?? "").replace(/^#/, "").trim();
  if (!rawHash) return null;
  if (rawHash.startsWith("R-")) return rawHash;
  const lower = rawHash.toLowerCase();
  if (lower.startsWith("r-")) {
    const trimmed = rawHash.slice(2).trim();
    return trimmed || null;
  }
  if (lower.startsWith("s-")) return null;
  return null;
}

type LinkedRuleListener = () => void;
const linkedRuleListeners = new Set<LinkedRuleListener>();

function notifyLinkedRuleListeners(): void {
  if (linkedRuleListeners.size === 0) return;
  for (const listener of linkedRuleListeners) listener();
}

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  }
  return null;
}

export function buildLinkedRulesKey(methodCode: string, version: string): string {
  return `verifyLinkedRules:${methodCode}@${version}`;
}

export function readLinkedRuleIdsFromStorage(methodCode: string, version: string): string[] {
  return loadLinkedRuleIds(buildLinkedRulesKey(methodCode, version));
}

export function loadLinkedRuleIds(key: string): string[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return uniqSorted(parsed.filter((value) => typeof value === "string"));
  } catch {
    return [];
  }
}

export function persistLinkedRuleIds(key: string, ids: string[]): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const next = uniqSorted(ids);
  const current = loadLinkedRuleIds(key);
  if (current.length === next.length && current.every((value, idx) => value === next[idx])) return;
  storage.setItem(key, JSON.stringify(next));
  notifyLinkedRuleListeners();
}

export function addLinkedRuleIdToStorage(key: string, ruleId: string | null | undefined): string[] {
  const current = loadLinkedRuleIds(key);
  const next = addLinkedRuleId(current, ruleId);
  persistLinkedRuleIds(key, next);
  return next;
}

export function subscribeLinkedRuleIds(listener: LinkedRuleListener): () => void {
  linkedRuleListeners.add(listener);
  return () => {
    linkedRuleListeners.delete(listener);
  };
}

function parseDatetimeRange(value: unknown): { start?: string; end?: string } | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  if (!raw.includes("/")) return { start: raw };
  const [startRaw, endRaw] = raw.split("/", 2);
  const start = asNonEmptyString(startRaw);
  const end = asNonEmptyString(endRaw);
  if (!start && !end) return null;
  return { start: start ?? undefined, end: end ?? undefined };
}

export function extractStacQuery(resultJson: unknown): RunSummary["stac"]["query"] {
  const root = asRecord(resultJson);
  if (!root) return {};
  const provenance = asRecord(root.provenance);
  const request = asRecord(root.request);

  const source =
    asNonEmptyString(provenance?.stac_base_url) ??
    asNonEmptyString(provenance?.endpoint) ??
    asNonEmptyString(provenance?.provider) ??
    null;

  const collections = Array.isArray(provenance?.collections)
    ? provenance?.collections
    : Array.isArray(request?.collections)
      ? request?.collections
      : null;
  const collection =
    Array.isArray(collections) && collections.length
      ? collections.map((value) => String(value)).join(", ")
      : asNonEmptyString(request?.collection) ??
        asNonEmptyString(provenance?.collection) ??
        null;

  const datetime = parseDatetimeRange(provenance?.datetime ?? request?.datetime);
  const limit = typeof provenance?.limit === "number" ? provenance?.limit : typeof request?.limit === "number" ? request?.limit : null;

  return {
    source,
    collection,
    datetime: datetime ?? undefined,
    limit,
    filters: null,
  };
}

export function buildRunSummary(input: Partial<RunSummary>): RunSummary {
  return {
    aoi: {
      hash: input.aoi?.hash ?? null,
      bbox: input.aoi?.bbox ?? null,
      areaKm2: typeof input.aoi?.areaKm2 === "number" ? input.aoi.areaKm2 : null,
    },
    stac: {
      query: input.stac?.query ?? {},
      itemIds: uniqSorted(input.stac?.itemIds),
    },
    linkage: {
      linkedRuleIds: uniqSorted(input.linkage?.linkedRuleIds),
    },
    exportState: {
      snapshotExportedAt: input.exportState?.snapshotExportedAt ?? null,
    },
    provenance: {
      methodCode: input.provenance?.methodCode ?? null,
      version: input.provenance?.version ?? null,
      repoCommit: input.provenance?.repoCommit ?? null,
      generatedAt: input.provenance?.generatedAt ?? null,
      snapshotSchemaVersion: input.provenance?.snapshotSchemaVersion ?? null,
    },
  };
}

export function createTicketTemplate(summary: RunSummary): string {
  const aoi = summary.aoi;
  const stacCount = summary.stac.itemIds.length;
  const linked = summary.linkage.linkedRuleIds.length;
  const header = `Verify run summary (${summary.provenance.methodCode ?? "unknown"}@${summary.provenance.version ?? "unknown"})`;
  return [
    `# ${header}`,
    "",
    `- AOI hash: ${aoi.hash ?? "n/a"}`,
    `- AOI bbox: ${aoi.bbox ? aoi.bbox.join(", ") : "n/a"}`,
    `- AOI area: ${typeof aoi.areaKm2 === "number" ? `${aoi.areaKm2.toFixed(2)} km^2` : "n/a"}`,
    `- STAC items: ${stacCount}`,
    `- Linked rules: ${linked}`,
    "",
    "## Notes",
    "- Outcome snapshot attached.",
    "",
  ].join("\n");
}
