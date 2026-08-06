export const VM0007_GAP_REPORT_AUDIT_PREFIX = "a6:vm0007-gap-report-audit:v1:";
export const VM0007_EVIDENCE_MAP_DRAFT_PREFIX = "article6:vm0007-evidence-map-draft:v1:";
export const VM0007_RETAINED_COMPLETE_PAIRS = 3;

export class Vm0007StorageWriteError extends Error {
  readonly code = "storage_write_failed" as const;

  constructor(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause ?? "Unknown storage error");
    super(`storage_write_failed: ${message}`);
    this.name = "Vm0007StorageWriteError";
  }
}

export function approximateSerializedSize(serialized: string): number {
  // localStorage quotas are byte-oriented in browsers; UTF-16 gives a useful
  // conservative estimate before attempting the write.
  return serialized.length * 2;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  return candidate.name === "QuotaExceededError" || candidate.code === 22 || candidate.code === 1014 || /quota|storage full/i.test(String(candidate.message ?? ""));
}

function readTimestamp(raw: string | null): number {
  if (!raw) return 0;
  try {
    const value = JSON.parse(raw) as { generatedAt?: unknown; updatedAt?: unknown };
    const timestamp = Date.parse(String(value.generatedAt ?? value.updatedAt ?? ""));
    return Number.isNaN(timestamp) ? 0 : timestamp;
  } catch {
    return 0;
  }
}

export function pruneOldVm0007Pairs(storage: Storage, currentId: string, retain = VM0007_RETAINED_COMPLETE_PAIRS): void {
  const auditIds = new Set<string>();
  const draftIds = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index);
    if (storageKey?.startsWith(VM0007_GAP_REPORT_AUDIT_PREFIX)) auditIds.add(storageKey.slice(VM0007_GAP_REPORT_AUDIT_PREFIX.length));
    if (storageKey?.startsWith(VM0007_EVIDENCE_MAP_DRAFT_PREFIX)) draftIds.add(storageKey.slice(VM0007_EVIDENCE_MAP_DRAFT_PREFIX.length));
  }

  const completePairs = [...auditIds].filter((auditId) => draftIds.has(auditId) && auditId !== currentId).map((auditId) => ({
    auditId,
    timestamp: Math.max(
      readTimestamp(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId}`)),
      readTimestamp(storage.getItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}${auditId}`)),
    ),
  })).sort((left, right) => right.timestamp - left.timestamp || right.auditId.localeCompare(left.auditId));

  for (const pair of completePairs.slice(retain)) {
    storage.removeItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${pair.auditId}`);
    storage.removeItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}${pair.auditId}`);
  }
}

export function writeVm0007Storage(storage: Storage, storageKey: string, serialized: string, currentId: string): void {
  // Keep the estimate observable in debugging/profiling without making a
  // browser-specific quota assumption.
  approximateSerializedSize(serialized);
  try {
    storage.setItem(storageKey, serialized);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) throw new Vm0007StorageWriteError(error);
    pruneOldVm0007Pairs(storage, currentId);
    try {
      storage.setItem(storageKey, serialized);
      return;
    } catch (retryError) {
      throw new Vm0007StorageWriteError(retryError);
    }
  }
}
