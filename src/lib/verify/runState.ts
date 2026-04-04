import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { isRuleLikeId } from "@/lib/proofMap/pins";

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
    selectedRuleId: string | null;
    linkedRuleIds: string[];
  };
  exportState: {
    snapshotExportedAt: string | null;
  };
  verifier: {
    runId: string | null;
    createdAt: string | null;
    minutes: string;
    outcomeNote: string;
    finalizedAt: string | null;
    finalizedState: "draft" | "finalized";
    checklist: VerifierChecklistItem[];
    delta: string;
    impact: string;
    tasks: VerifierTask[];
  };
  provenance: {
    methodCode?: string | null;
    version?: string | null;
    repoCommit?: string | null;
    generatedAt?: string | null;
    snapshotSchemaVersion?: string | null;
  };
};

export type VerifierChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
  updatedAt: string;
};

export type VerifierTask = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

let taskCounter = 0;
let lastRunIdStamp = "";
let runIdSequence = 0;

export type VerifierRunContext = {
  runId: string;
  createdAt: string;
};

export type ReviewerArtifactContext = {
  methodCode: string;
  version: string;
  ruleId: string | null;
  runId: string;
};

export type ReviewerArtifactState = {
  context: ReviewerArtifactContext;
  savedReviewerArtifactAt: string | null;
  minutes: string;
  outcomeNote: string;
  draftMinutes: string;
  draftOutcomeNote: string;
};

export type VerifierRunBundle = {
  runContext: VerifierRunContext;
  reviewerContext: ReviewerArtifactContext;
  savedReviewerArtifactContext: ReviewerArtifactContext | null;
  exportedAt: string | null;
  savedReviewerArtifactAt: string | null;
  finalizedAt: string | null;
  loadedFromRunId: string | null;
  derivedFromRunId: string | null;
  isEditedDraft: boolean;
  minutes: string;
  outcomeNote: string;
  draftMinutes: string;
  draftOutcomeNote: string;
  checklist: VerifierChecklistItem[];
  delta: string;
  impact: string;
  tasks: VerifierTask[];
};

export type VerifyRunStatus = "in_progress" | "reviewer_artifact_saved" | "ready_to_finalize" | "finalized";

export type VerifyRunStatusDetails = {
  status: VerifyRunStatus;
  label: string;
  missing: string[];
  nextAction: string | null;
};

export type VerifyWizardStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type VerifyWizardStepDetails = {
  activeStep: VerifyWizardStepId | null;
  nextAction: string | null;
  steps: Array<{
    id: VerifyWizardStepId;
    label: string;
    complete: boolean;
    active: boolean;
    disabled: boolean;
  }>;
  isComplete: boolean;
};

export type VerifyRunHistoryBundle = VerifierRunBundle & {
  selectedRuleId: string | null;
  linkedRuleIds: string[];
  aoi: AOI | null;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
  selectedStacItemId: string | null;
};

export type VerifyRunHistoryEntry = {
  runId: string;
  createdAt: string;
  bundle: VerifyRunHistoryBundle;
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

function nowIso(): string {
  return new Date().toISOString();
}

function buildRunId(methodCode: string, version: string, date = new Date()): string {
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
    String(date.getMilliseconds()).padStart(3, "0"),
  ].join("");
  if (stamp === lastRunIdStamp) runIdSequence += 1;
  else {
    lastRunIdStamp = stamp;
    runIdSequence = 0;
  }
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const suffix = runIdSequence > 0 ? `-${String(runIdSequence).padStart(2, "0")}` : "";
  return `${normalizedMethod}-${normalizedVersion}-${stamp}${suffix}`;
}

function seedChecklist(timestamp: string): VerifierChecklistItem[] {
  return [
    { id: "read-overview", label: "Read method overview", checked: false, updatedAt: timestamp },
    { id: "reviewed-sections", label: "Reviewed relevant sections", checked: false, updatedAt: timestamp },
    { id: "checked-anchors", label: "Checked rule anchors", checked: false, updatedAt: timestamp },
    { id: "verified-layer-inputs", label: "Verified spatial evidence layer inputs", checked: false, updatedAt: timestamp },
    { id: "exported-snapshot", label: "Exported snapshot", checked: false, updatedAt: timestamp },
  ];
}

function normalizeChecklist(
  raw: unknown,
  fallback: VerifierChecklistItem[],
  timestamp: string,
): VerifierChecklistItem[] {
  if (!Array.isArray(raw)) return fallback;
  const items: VerifierChecklistItem[] = [];
  raw.forEach((value, index) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const id = asNonEmptyString(record.id) ?? `item-${index + 1}`;
    const label = asNonEmptyString(record.label) ?? id;
    const checked = typeof record.checked === "boolean" ? record.checked : false;
    const updatedAt = asNonEmptyString(record.updatedAt) ?? timestamp;
    items.push({ id, label, checked, updatedAt });
  });
  return items.length ? items : fallback;
}

function normalizeTasks(raw: unknown, timestamp: string): VerifierTask[] {
  if (!Array.isArray(raw)) return [];
  const tasks: VerifierTask[] = [];
  raw.forEach((value, index) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const id = asNonEmptyString(record.id) ?? `task-${index + 1}`;
    const text = asNonEmptyString(record.text) ?? "";
    const done = typeof record.done === "boolean" ? record.done : false;
    const createdAt = asNonEmptyString(record.createdAt) ?? timestamp;
    const updatedAt = asNonEmptyString(record.updatedAt) ?? createdAt;
    tasks.push({ id, text, done, createdAt, updatedAt });
  });
  return tasks;
}

export function addTaskWithText(text: string): VerifierTask {
  const trimmed = text.trim();
  const now = nowIso();
  taskCounter += 1;
  const stamp = now.replace(/[:.]/g, "");
  return {
    id: `task-${stamp}-${taskCounter}`,
    text: trimmed,
    done: false,
    createdAt: now,
    updatedAt: now,
  };
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
  if (rawHash.startsWith("r-")) {
    const trimmed = rawHash.slice(2).trim();
    return trimmed || null;
  }
  if (isRuleLikeId(rawHash)) return rawHash;
  if (rawHash.startsWith("s-")) return null;
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

export function normalizeMethodCode(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const atIndex = trimmed.indexOf("@");
  return atIndex >= 0 ? trimmed.slice(0, atIndex).trim() : trimmed;
}

export function normalizeVersion(raw: string): string {
  let trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("v/")) trimmed = trimmed.slice(2);
  if (!trimmed.startsWith("v")) trimmed = `v${trimmed}`;
  return trimmed;
}

export function buildVerifyRunKey(methodCode: string, version: string): string {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  return `verify:${normalizedMethod}:${normalizedVersion}`;
}

function buildRunHistoryKey(methodCode: string, version: string): string {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  return `verifyRunHistory:${normalizedMethod}:${normalizedVersion}`;
}

function buildReviewerArtifactStorageKey(context: ReviewerArtifactContext): string {
  const normalizedMethod = normalizeMethodCode(context.methodCode);
  const normalizedVersion = normalizeVersion(context.version);
  const normalizedRuleId = (context.ruleId ?? "").trim() || "__no_rule__";
  const normalizedRunId = context.runId.trim();
  return `verifyReviewerArtifact:${normalizedMethod}:${normalizedVersion}:${normalizedRuleId}:${normalizedRunId}`;
}

export function buildLinkedRulesKey(methodCode: string, version: string): string {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  return `verifyLinkedRules:${normalizedMethod}:${normalizedVersion}`;
}

export function createReviewerArtifactContext(input: {
  methodCode: string;
  version: string;
  ruleId: string | null;
  runId: string;
}): ReviewerArtifactContext {
  return {
    methodCode: normalizeMethodCode(input.methodCode),
    version: normalizeVersion(input.version),
    ruleId: asNonEmptyString(input.ruleId) ?? null,
    runId: input.runId.trim(),
  };
}

export function reviewerArtifactContextMatches(
  left: ReviewerArtifactContext | null | undefined,
  right: ReviewerArtifactContext | null | undefined,
): boolean {
  if (!left || !right) return false;
  return (
    normalizeMethodCode(left.methodCode) === normalizeMethodCode(right.methodCode) &&
    normalizeVersion(left.version) === normalizeVersion(right.version) &&
    (asNonEmptyString(left.ruleId) ?? null) === (asNonEmptyString(right.ruleId) ?? null) &&
    left.runId.trim() === right.runId.trim()
  );
}

function normalizeReviewerArtifactContext(raw: unknown, fallback: ReviewerArtifactContext): ReviewerArtifactContext {
  const record = asRecord(raw);
  if (!record) return fallback;
  return {
    methodCode: asNonEmptyString(record.methodCode) ?? fallback.methodCode,
    version: asNonEmptyString(record.version) ?? fallback.version,
    ruleId: asNonEmptyString(record.ruleId) ?? null,
    runId: asNonEmptyString(record.runId) ?? fallback.runId,
  };
}

function normalizeReviewerArtifactState(raw: unknown, fallback: ReviewerArtifactContext): ReviewerArtifactState | null {
  const record = asRecord(raw);
  if (!record) return null;
  const context = normalizeReviewerArtifactContext(record.context, fallback);
  return {
    context,
    savedReviewerArtifactAt: asNonEmptyString(record.savedReviewerArtifactAt),
    minutes: typeof record.minutes === "string" ? record.minutes : "",
    outcomeNote: typeof record.outcomeNote === "string" ? record.outcomeNote : "",
    draftMinutes: typeof record.draftMinutes === "string" ? record.draftMinutes : "",
    draftOutcomeNote: typeof record.draftOutcomeNote === "string" ? record.draftOutcomeNote : "",
  };
}

export function readReviewerArtifactState(context: ReviewerArtifactContext): ReviewerArtifactState | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  const key = buildReviewerArtifactStorageKey(context);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    return normalizeReviewerArtifactState(JSON.parse(raw), context);
  } catch {
    return null;
  }
}

export function persistReviewerArtifactState(state: ReviewerArtifactState): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const key = buildReviewerArtifactStorageKey(state.context);
  const hasContent = Boolean(
    state.savedReviewerArtifactAt ||
      state.minutes.trim() ||
      state.outcomeNote.trim() ||
      state.draftMinutes.trim() ||
      state.draftOutcomeNote.trim(),
  );
  if (!hasContent) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(state));
}

function migrateLinkedRulesKey(methodCode: string, version: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const canonical = buildLinkedRulesKey(normalizedMethod, normalizedVersion);
  if (storage.getItem(canonical)) return;
  const keysToMerge: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (key === canonical) continue;
    if (key.startsWith(`verifyLinkedRules:${normalizedMethod}:`)) keysToMerge.push(key);
    if (key.startsWith(`verifyLinkedRules:${normalizedMethod}@`)) keysToMerge.push(key);
    if (key.startsWith(`verifyLinkedRules:${normalizedMethod}v`)) keysToMerge.push(key);
  }
  if (!keysToMerge.length) return;
  const merged = new Set<string>();
  for (const key of keysToMerge) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (typeof value === "string") merged.add(value.trim());
        }
      }
    } catch {
      // ignore
    }
  }
  const next = Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
  if (!next.length) return;
  storage.setItem(canonical, JSON.stringify(next));
  for (const key of keysToMerge) storage.removeItem(key);
}

export function readLinkedRuleIdsFromStorage(methodCode: string, version: string): string[] {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  migrateLinkedRulesKey(normalizedMethod, normalizedVersion);
  return loadLinkedRuleIds(buildLinkedRulesKey(normalizedMethod, normalizedVersion));
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

function addLinkedRuleIdToKey(key: string, ruleId: string | null | undefined): string[] {
  const current = loadLinkedRuleIds(key);
  const next = addLinkedRuleId(current, ruleId);
  persistLinkedRuleIds(key, next);
  return next;
}

export function addLinkedRuleIdToStorage(
  methodCode: string,
  version: string,
  ruleId: string | null | undefined,
): string[] {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const key = buildLinkedRulesKey(normalizedMethod, normalizedVersion);
  return addLinkedRuleIdToKey(key, ruleId);
}

export function setLinkedRuleIdsInStorage(methodCode: string, version: string, ids: string[]): string[] {
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const key = buildLinkedRulesKey(normalizedMethod, normalizedVersion);
  persistLinkedRuleIds(key, ids);
  return loadLinkedRuleIds(key);
}

export function createVerifierRunBundle(methodCode: string, version: string): VerifierRunBundle {
  const createdAt = nowIso();
  const runId = buildRunId(methodCode, version, new Date(createdAt));
  return {
    runContext: {
      runId,
      createdAt,
    },
    reviewerContext: createReviewerArtifactContext({
      methodCode,
      version,
      ruleId: null,
      runId,
    }),
    savedReviewerArtifactContext: null,
    exportedAt: null,
    savedReviewerArtifactAt: null,
    finalizedAt: null,
    loadedFromRunId: null,
    derivedFromRunId: null,
    isEditedDraft: false,
    minutes: "",
    outcomeNote: "",
    draftMinutes: "",
    draftOutcomeNote: "",
    checklist: seedChecklist(createdAt),
    delta: "",
    impact: "",
    tasks: [],
  };
}

export function readVerifierRunBundle(methodCode: string, version: string): VerifierRunBundle {
  const storage = getLocalStorage();
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const canonical = buildVerifyRunKey(normalizedMethod, normalizedVersion);
  const fallback = createVerifierRunBundle(normalizedMethod, normalizedVersion);
  if (!storage) return fallback;

  if (!storage.getItem(canonical)) {
    const legacyKeys = [
      `verify:${normalizedMethod}@${normalizedVersion}`,
      `verify:${normalizedMethod}`,
    ];
    const legacyKey = legacyKeys.find((key) => storage.getItem(key));
    if (legacyKey) {
      const rawLegacy = storage.getItem(legacyKey);
      if (rawLegacy) storage.setItem(canonical, rawLegacy);
      storage.removeItem(legacyKey);
    }
  }

  const raw = storage.getItem(canonical);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const minutes = typeof parsed.minutes === "string" ? parsed.minutes : "";
    const outcomeNote = typeof parsed.outcomeNote === "string" ? parsed.outcomeNote : "";
    const draftMinutes = typeof parsed.draftMinutes === "string" ? parsed.draftMinutes : minutes;
    const draftOutcomeNote = typeof parsed.draftOutcomeNote === "string" ? parsed.draftOutcomeNote : outcomeNote;
    const delta = typeof parsed.delta === "string" ? parsed.delta : "";
    const impact = typeof parsed.impact === "string" ? parsed.impact : "";
    const exportedAt = asNonEmptyString(parsed.exportedAt);
    const savedReviewerArtifactAt = asNonEmptyString(parsed.savedReviewerArtifactAt);
    const finalizedAt = asNonEmptyString(parsed.finalizedAt);
    const loadedFromRunId = asNonEmptyString(parsed.loadedFromRunId);
    const derivedFromRunId = asNonEmptyString(parsed.derivedFromRunId);
    const isEditedDraft = typeof parsed.isEditedDraft === "boolean" ? parsed.isEditedDraft : false;
    const runContextRaw = parsed.runContext && typeof parsed.runContext === "object" ? (parsed.runContext as Record<string, unknown>) : null;
    const runId = asNonEmptyString(runContextRaw?.runId) ?? fallback.runContext.runId;
    const createdAt = asNonEmptyString(runContextRaw?.createdAt) ?? fallback.runContext.createdAt;
    const reviewerContextFallback = createReviewerArtifactContext({
      methodCode: normalizedMethod,
      version: normalizedVersion,
      ruleId: null,
      runId,
    });
    const reviewerContext = normalizeReviewerArtifactContext(parsed.reviewerContext, reviewerContextFallback);
    const savedReviewerArtifactContextRaw = normalizeReviewerArtifactState(
      parsed.savedReviewerArtifactContext ? { context: parsed.savedReviewerArtifactContext } : null,
      reviewerContext,
    )?.context;
    const checklist = normalizeChecklist(parsed.checklist, fallback.checklist, createdAt);
    const tasks = normalizeTasks(parsed.tasks, createdAt);
    return {
      runContext: { runId, createdAt },
      reviewerContext,
      savedReviewerArtifactContext: savedReviewerArtifactContextRaw ?? null,
      exportedAt,
      savedReviewerArtifactAt,
      finalizedAt,
      loadedFromRunId,
      derivedFromRunId,
      isEditedDraft,
      minutes,
      outcomeNote,
      draftMinutes,
      draftOutcomeNote,
      checklist,
      delta,
      impact,
      tasks,
    };
  } catch {
    return fallback;
  }
}

export function persistVerifierRunBundle(methodCode: string, version: string, bundle: VerifierRunBundle): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const key = buildVerifyRunKey(normalizedMethod, normalizedVersion);
  storage.setItem(key, JSON.stringify(bundle));
}

function normalizeRunHistory(raw: unknown): VerifyRunHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: VerifyRunHistoryEntry[] = [];
  raw.forEach((value) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const runId = asNonEmptyString(record.runId);
    const createdAt = asNonEmptyString(record.createdAt);
    const bundle = record.bundle && typeof record.bundle === "object" ? (record.bundle as VerifyRunHistoryBundle) : null;
    if (!runId || !createdAt || !bundle) return;
    entries.push({ runId, createdAt, bundle });
  });
  return entries;
}

export function readRunHistory(methodCode: string, version: string): VerifyRunHistoryEntry[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const key = buildRunHistoryKey(methodCode, version);
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeRunHistory(parsed).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function saveCurrentRunToHistory(
  methodCode: string,
  version: string,
  bundle: VerifyRunHistoryBundle,
): VerifyRunHistoryEntry[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const key = buildRunHistoryKey(methodCode, version);
  const createdAt = bundle.runContext.createdAt || nowIso();
  const entry: VerifyRunHistoryEntry = { runId: bundle.runContext.runId, createdAt, bundle };
  const existing = readRunHistory(methodCode, version);
  const without = existing.filter((item) => item.runId !== entry.runId);
  const next = [entry, ...without].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function loadRunFromHistory(
  methodCode: string,
  version: string,
  runId: string,
): VerifyRunHistoryBundle | null {
  const history = readRunHistory(methodCode, version);
  const match = history.find((entry) => entry.runId === runId);
  return match ? match.bundle : null;
}

export function deleteRunFromHistory(methodCode: string, version: string, runId: string): VerifyRunHistoryEntry[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  const next = readRunHistory(methodCode, version).filter((entry) => entry.runId !== runId);
  storage.setItem(buildRunHistoryKey(methodCode, version), JSON.stringify(next));
  return next;
}

export function shortRunId(runId: string, length = 8): string {
  if (!runId) return "";
  return runId.length <= length ? runId : runId.slice(-length);
}

export function clearLinkedRuleIdsFromStorage(methodCode: string, version: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const normalizedMethod = normalizeMethodCode(methodCode);
  const normalizedVersion = normalizeVersion(version);
  const canonical = buildLinkedRulesKey(normalizedMethod, normalizedVersion);
  storage.removeItem(canonical);
  const legacyPrefixes = [
    `verifyLinkedRules:${normalizedMethod}:`,
    `verifyLinkedRules:${normalizedMethod}@`,
    `verifyLinkedRules:${normalizedMethod}v`,
  ];
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || key === canonical) continue;
    if (legacyPrefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
  notifyLinkedRuleListeners();
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
      selectedRuleId: input.linkage?.selectedRuleId ?? null,
      linkedRuleIds: uniqSorted(input.linkage?.linkedRuleIds),
    },
    exportState: {
      snapshotExportedAt: input.exportState?.snapshotExportedAt ?? null,
    },
    verifier: {
      runId: input.verifier?.runId ?? null,
      createdAt: input.verifier?.createdAt ?? null,
      minutes: input.verifier?.minutes ?? "",
      outcomeNote: input.verifier?.outcomeNote ?? "",
      finalizedAt: input.verifier?.finalizedAt ?? null,
      finalizedState: input.verifier?.finalizedState ?? "draft",
      checklist: input.verifier?.checklist ?? [],
      delta: input.verifier?.delta ?? "",
      impact: input.verifier?.impact ?? "",
      tasks: input.verifier?.tasks ?? [],
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

export function hasReviewerArtifact(input: { minutes?: string | null; outcomeNote?: string | null }): boolean {
  return Boolean(input.minutes?.trim() || input.outcomeNote?.trim());
}

export function getVerifyRunStatusDetails(input: {
  selectedRuleId?: string | null;
  aoiHash?: string | null;
  stacItemIds?: string[] | null;
  selectedStacItemId?: string | null;
  linkedRuleIds?: string[] | null;
  snapshotExportedAt?: string | null;
  reviewerArtifactSavedAt?: string | null;
  finalizedAt?: string | null;
  minutes?: string | null;
  outcomeNote?: string | null;
}): VerifyRunStatusDetails {
  if (input.finalizedAt?.trim()) {
    return {
      status: "finalized",
      label: "Finalized",
      missing: [],
      nextAction: null,
    };
  }

  const missing: string[] = [];
  if (!input.selectedRuleId?.trim()) missing.push("Select a rule");
  if (!input.aoiHash?.trim()) missing.push("Add an AOI");
  if (!(input.stacItemIds?.length)) missing.push("Search STAC");
  if (!input.selectedStacItemId?.trim()) missing.push("Select an evidence item");
  if (!(input.linkedRuleIds?.length)) missing.push("Link evidence to the rule");

  if (missing.length > 0) {
    return {
      status: "in_progress",
      label: "In progress",
      missing,
      nextAction: missing[0] ?? null,
    };
  }

  const reviewerArtifactSaved = Boolean(input.reviewerArtifactSavedAt?.trim());
  if (!reviewerArtifactSaved) {
    return {
      status: "in_progress",
      label: "In progress",
      missing: ["Save reviewer artifact"],
      nextAction: "Save reviewer artifact",
    };
  }

  return {
    status: "ready_to_finalize",
    label: "Ready to finalize",
    missing: ["Finalize run"],
    nextAction: "Finalize run",
  };
}

export function getVerifyWizardStepDetails(input: {
  selectedRuleId?: string | null;
  aoiHash?: string | null;
  stacItemIds?: string[] | null;
  selectedStacItemId?: string | null;
  linkedRuleIds?: string[] | null;
  snapshotExportedAt?: string | null;
  reviewerArtifactSavedAt?: string | null;
  minutes?: string | null;
  outcomeNote?: string | null;
  finalizedAt?: string | null;
}): VerifyWizardStepDetails {
  const hasRule = Boolean(input.selectedRuleId?.trim());
  const hasAoi = Boolean(input.aoiHash?.trim());
  const hasSearchResults = Boolean(input.stacItemIds?.length);
  const hasSelectedItem = Boolean(input.selectedStacItemId?.trim());
  const hasPins = Boolean(input.linkedRuleIds?.length);
  const hasSavedReviewerArtifact = Boolean(input.reviewerArtifactSavedAt?.trim());
  const isFinalized = Boolean(input.finalizedAt?.trim());

  const activeStep: VerifyWizardStepId | null =
    !hasRule ? 1 :
    !hasAoi ? 2 :
    !hasSearchResults ? 3 :
    !hasSelectedItem ? 4 :
    !hasPins ? 5 :
    !hasSavedReviewerArtifact ? 6 :
    !isFinalized ? 7 :
    null;

  const steps: VerifyWizardStepDetails["steps"] = [
    { id: 1, label: "Pick rule", complete: hasRule, active: activeStep === 1, disabled: false },
    { id: 2, label: "Confirm AOI", complete: hasAoi, active: activeStep === 2, disabled: !hasRule },
    { id: 3, label: "Search STAC", complete: hasSearchResults, active: activeStep === 3, disabled: !hasAoi },
    { id: 4, label: "Select item", complete: hasSelectedItem, active: activeStep === 4, disabled: !hasSearchResults },
    { id: 5, label: "Create/link pin", complete: hasPins, active: activeStep === 5, disabled: !hasSelectedItem || !hasRule },
    { id: 6, label: "Save reviewer artifact", complete: hasSavedReviewerArtifact, active: activeStep === 6, disabled: !hasPins },
    { id: 7, label: "Finalize run", complete: isFinalized, active: activeStep === 7, disabled: !hasPins || !hasSavedReviewerArtifact },
  ];

  return {
    activeStep,
    nextAction: steps.find((step) => step.active)?.label ?? null,
    steps,
    isComplete: isFinalized,
  };
}

export function createTicketTemplate(summary: RunSummary): string {
  const aoi = summary.aoi;
  const stacCount = summary.stac.itemIds.length;
  const linked = summary.linkage.linkedRuleIds.length;
  const runId = summary.verifier.runId ?? "unknown";
  const checklistLines = summary.verifier.checklist.map((item) => `- [${item.checked ? "x" : " "}] ${item.label}`);
  const taskLines = summary.verifier.tasks.map((task) => `- [${task.done ? "x" : " "}] ${task.text || task.id}`);
  const header = `Verify run summary (${summary.provenance.methodCode ?? "unknown"}@${summary.provenance.version ?? "unknown"})`;
  return [
    `# ${header}`,
    `- Run: ${runId}`,
    "",
    `- AOI hash: ${aoi.hash ?? "n/a"}`,
    `- AOI bbox: ${aoi.bbox ? aoi.bbox.join(", ") : "n/a"}`,
    `- AOI area: ${typeof aoi.areaKm2 === "number" ? `${aoi.areaKm2.toFixed(2)} km^2` : "n/a"}`,
    `- STAC items: ${stacCount}`,
    `- Linked rules: ${linked}`,
    "",
    "## Minutes",
    summary.verifier.minutes?.trim() ? summary.verifier.minutes.trim() : "_None_",
    "",
    "## Outcome note",
    summary.verifier.outcomeNote?.trim() ? summary.verifier.outcomeNote.trim() : "_None_",
    "",
    "## Delta",
    summary.verifier.delta?.trim() ? summary.verifier.delta.trim() : "_None_",
    "",
    "## Impact",
    summary.verifier.impact?.trim() ? summary.verifier.impact.trim() : "_None_",
    "",
    "## Tasks",
    taskLines.length ? taskLines.join("\n") : "- _No tasks_",
    "",
    "## Checklist",
    checklistLines.length ? checklistLines.join("\n") : "- _No checklist items_",
    "",
    "## Notes",
    "- Outcome snapshot attached.",
    "",
  ].join("\n");
}
