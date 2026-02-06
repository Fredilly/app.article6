import type { RunKpis } from "@/lib/verify/kpis";

export type BaselineKey = {
  methodId: string;
  versionId: string;
  harnessVersion: string;
  datasetHash: string;
};

export type BaselineRecord = {
  baselineRunId: string;
  baselineTs: string;
  baselineKpis: RunKpis;
  baselineProvenance: BaselineKey;
  rotationLog?: Array<{ ts: string; prevRunId: string; nextRunId: string; reason: string }>;
};

const BASELINE_PREFIX = "a6:baseline:";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  }
  return null;
}

function normalizePart(value: string): string {
  return encodeURIComponent(String(value ?? "").trim());
}

function buildBaselineStorageKey(key: BaselineKey): string {
  return `${BASELINE_PREFIX}${normalizePart(key.methodId)}:${normalizePart(key.versionId)}:${normalizePart(
    key.harnessVersion,
  )}:${normalizePart(key.datasetHash)}`;
}

function readBaseline(storage: Storage, key: string): BaselineRecord | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BaselineRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getBaseline(key: BaselineKey): BaselineRecord | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  return readBaseline(storage, buildBaselineStorageKey(key));
}

export function setBaseline(key: BaselineKey, baseline: BaselineRecord): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(buildBaselineStorageKey(key), JSON.stringify(baseline));
}

export function clearBaseline(key: BaselineKey): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(buildBaselineStorageKey(key));
}

export function rotateBaseline(key: BaselineKey, next: BaselineRecord, reason: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const current = readBaseline(storage, buildBaselineStorageKey(key));
  const log = current?.rotationLog ? [...current.rotationLog] : [];
  if (current?.baselineRunId) {
    log.push({
      ts: new Date().toISOString(),
      prevRunId: current.baselineRunId,
      nextRunId: next.baselineRunId,
      reason,
    });
  }
  storage.setItem(
    buildBaselineStorageKey(key),
    JSON.stringify({
      ...next,
      rotationLog: log.length ? log : undefined,
    }),
  );
}

export function getLatestBaselineForMethod(methodId: string, versionId: string): BaselineRecord | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  let latest: BaselineRecord | null = null;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(BASELINE_PREFIX)) continue;
    const entry = readBaseline(storage, key);
    if (!entry) continue;
    if (entry.baselineProvenance?.methodId !== methodId) continue;
    if (entry.baselineProvenance?.versionId !== versionId) continue;
    if (!latest) {
      latest = entry;
      continue;
    }
    if (entry.baselineTs && entry.baselineTs > latest.baselineTs) {
      latest = entry;
    }
  }
  return latest;
}
