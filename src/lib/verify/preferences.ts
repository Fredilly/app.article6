import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { sha256Text } from "@/lib/proof/hash";

export type PreferenceChoice = "left" | "right" | "tie" | "skip";

export type PreferenceEvent = {
  eventId: string;
  runId: string;
  methodCode: string;
  version: string;
  ruleId?: string;
  pairKey: string;
  leftEvidenceKey: string;
  rightEvidenceKey: string;
  choice: PreferenceChoice;
  rationale?: string;
  seq: number;
};

export type PreferenceEventDraft = {
  methodCode: string;
  version: string;
  ruleId?: string | null;
  pairKey: string;
  leftEvidenceKey: string;
  rightEvidenceKey: string;
  choice: PreferenceChoice;
  rationale?: string | null;
};

export class PreferenceStorageError extends Error {
  readonly code: "storage_unavailable" | "storage_read_failed" | "storage_write_failed";

  constructor(code: PreferenceStorageError["code"], message: string) {
    super(message);
    this.name = "PreferenceStorageError";
    this.code = code;
  }
}

function normalizeMethodCode(raw: string): string {
  return (raw ?? "").trim();
}

function normalizeVersion(raw: string): string {
  return (raw ?? "").trim();
}

function storageKey(methodCode: string, version: string, runId: string): string {
  return `verifyPreferenceEvents:${normalizeMethodCode(methodCode)}:${normalizeVersion(version)}:${runId.trim()}`;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeChoice(value: unknown): PreferenceChoice | null {
  if (value === "left" || value === "right" || value === "tie" || value === "skip") return value;
  return null;
}

function normalizeSeq(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  const asInt = Math.trunc(value);
  if (asInt < 1) return null;
  return asInt;
}

function normalizeEvent(value: unknown): PreferenceEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const eventId = asNonEmptyString(record.eventId);
  const runId = asNonEmptyString(record.runId);
  const methodCode = asNonEmptyString(record.methodCode);
  const version = asNonEmptyString(record.version);
  const pairKey = asNonEmptyString(record.pairKey);
  const leftEvidenceKey = asNonEmptyString(record.leftEvidenceKey);
  const rightEvidenceKey = asNonEmptyString(record.rightEvidenceKey);
  const choice = normalizeChoice(record.choice);
  const seq = normalizeSeq(record.seq);

  if (!eventId || !runId || !methodCode || !version || !pairKey || !leftEvidenceKey || !rightEvidenceKey || !choice || !seq) {
    return null;
  }

  const ruleId = asNonEmptyString(record.ruleId) ?? undefined;
  const rationale = asNonEmptyString(record.rationale) ?? undefined;

  return {
    eventId,
    runId,
    methodCode,
    version,
    ruleId,
    pairKey,
    leftEvidenceKey,
    rightEvidenceKey,
    choice,
    rationale,
    seq,
  };
}

function stableSort(events: PreferenceEvent[]): PreferenceEvent[] {
  return [...events].sort((a, b) => {
    const seqCmp = a.seq - b.seq;
    if (seqCmp !== 0) return seqCmp;
    return a.eventId.localeCompare(b.eventId);
  });
}

function getLocalStorage(): Storage {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    const maybe = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (maybe) return maybe;
  }
  throw new PreferenceStorageError("storage_unavailable", "Local storage is unavailable.");
}

export function makePairKey(a: string, b: string): string {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  const ordered = [left, right].sort((x, y) => x.localeCompare(y));
  return `${ordered[0]}::${ordered[1]}`;
}

export async function makeEventId(input: {
  runId: string;
  ruleId?: string | null;
  pairKey: string;
  choice: PreferenceChoice;
  seq: number;
}): Promise<string> {
  const payload = {
    runId: (input.runId ?? "").trim(),
    ruleId: asNonEmptyString(input.ruleId) ?? null,
    pairKey: (input.pairKey ?? "").trim(),
    choice: input.choice,
    seq: Math.trunc(input.seq),
  };
  return await sha256Text(canonicalJsonStringify(payload));
}

export function listPreferenceEvents(methodCode: string, version: string, runId: string): PreferenceEvent[] {
  const storage = getLocalStorage();
  const key = storageKey(methodCode, version, runId);
  let raw = "";
  try {
    raw = storage.getItem(key) ?? "";
  } catch (error) {
    throw new PreferenceStorageError("storage_read_failed", error instanceof Error ? error.message : "Failed to read preferences.");
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map((item) => normalizeEvent(item)).filter((item): item is PreferenceEvent => item !== null);
    return stableSort(normalized);
  } catch (error) {
    throw new PreferenceStorageError("storage_read_failed", error instanceof Error ? error.message : "Failed to parse preferences.");
  }
}

export async function appendPreferenceEvent(runId: string, draft: PreferenceEventDraft): Promise<PreferenceEvent> {
  const storage = getLocalStorage();
  const normalizedRunId = (runId ?? "").trim();
  const normalizedMethodCode = normalizeMethodCode(draft.methodCode);
  const normalizedVersion = normalizeVersion(draft.version);

  if (!normalizedRunId || !normalizedMethodCode || !normalizedVersion) {
    throw new PreferenceStorageError("storage_write_failed", "Missing run/method/version for preference event.");
  }

  const key = storageKey(normalizedMethodCode, normalizedVersion, normalizedRunId);
  const existing = listPreferenceEvents(normalizedMethodCode, normalizedVersion, normalizedRunId);
  const nextSeq = (existing[existing.length - 1]?.seq ?? 0) + 1;

  const choice = normalizeChoice(draft.choice);
  if (!choice) throw new PreferenceStorageError("storage_write_failed", "Invalid preference choice.");

  const leftEvidenceKey = asNonEmptyString(draft.leftEvidenceKey);
  const rightEvidenceKey = asNonEmptyString(draft.rightEvidenceKey);
  const pairKey = asNonEmptyString(draft.pairKey) ?? (leftEvidenceKey && rightEvidenceKey ? makePairKey(leftEvidenceKey, rightEvidenceKey) : null);

  if (!leftEvidenceKey || !rightEvidenceKey || !pairKey) {
    throw new PreferenceStorageError("storage_write_failed", "Missing evidence keys for preference event.");
  }

  const ruleId = asNonEmptyString(draft.ruleId ?? undefined) ?? undefined;
  const rationale = asNonEmptyString(draft.rationale ?? undefined) ?? undefined;

  const eventId = await makeEventId({ runId: normalizedRunId, ruleId: ruleId ?? null, pairKey, choice, seq: nextSeq });
  const nextEvent: PreferenceEvent = {
    eventId,
    runId: normalizedRunId,
    methodCode: normalizedMethodCode,
    version: normalizedVersion,
    ruleId,
    pairKey,
    leftEvidenceKey,
    rightEvidenceKey,
    choice,
    rationale,
    seq: nextSeq,
  };

  const nextList = stableSort([...existing, nextEvent]);
  try {
    storage.setItem(key, JSON.stringify(nextList));
  } catch (error) {
    throw new PreferenceStorageError("storage_write_failed", error instanceof Error ? error.message : "Failed to persist preferences.");
  }

  return nextEvent;
}
