import { addTaskWithText, buildVerifyRunKey, normalizeMethodCode, normalizeVersion, persistVerifierRunBundle, readVerifierRunBundle } from "@/lib/verify/runState";

export type CoverageTask = {
  id: string;
  ruleId: string;
  created_at: string;
  status: "open" | "done";
  key?: string;
};

const taskPrefix = "a6:coverage:tasks";

function nowIso(): string {
  return new Date().toISOString();
}

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage?: Storage }).localStorage ?? null;
  }
  return null;
}

function buildTaskKey(methodCode: string, version: string): string {
  const method = normalizeMethodCode(methodCode);
  const ver = normalizeVersion(version);
  return `${taskPrefix}:${method}:${ver}`;
}

export function buildCoverageTaskKey(methodCode: string, version: string, ruleId: string): string {
  const method = normalizeMethodCode(methodCode);
  const ver = normalizeVersion(version);
  return `coverage:${method}@${ver}:${ruleId}`;
}

export function loadCoverageTasks(methodCode: string, version: string): CoverageTask[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(buildTaskKey(methodCode, version));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoverageTask[]) : [];
  } catch {
    return [];
  }
}

export function addCoverageTask(input: { methodCode: string; version: string; ruleId: string }): { storedIn: "verify" | "coverage"; action: "added" | "removed" } {
  const storage = getStorage();
  const verifyKey = buildVerifyRunKey(input.methodCode, input.version);
  const hasVerifyBundle = storage ? Boolean(storage.getItem(verifyKey)) : false;
  const taskKey = buildCoverageTaskKey(input.methodCode, input.version, input.ruleId);

  if (hasVerifyBundle) {
    const bundle = readVerifierRunBundle(input.methodCode, input.version);
    const existing = bundle.tasks.filter((task) => task.text.includes(taskKey));
    if (existing.length > 0) {
      const next = { ...bundle, tasks: bundle.tasks.filter((task) => !task.text.includes(taskKey)) };
      persistVerifierRunBundle(input.methodCode, input.version, next);
      return { storedIn: "verify", action: "removed" };
    }
    const task = addTaskWithText(`Coverage: ${input.ruleId} [${taskKey}]`);
    const next = { ...bundle, tasks: [...bundle.tasks, task] };
    persistVerifierRunBundle(input.methodCode, input.version, next);
    return { storedIn: "verify", action: "added" };
  }

  const tasks = loadCoverageTasks(input.methodCode, input.version);
  const remaining = tasks.filter((task) => task.ruleId !== input.ruleId);
  if (remaining.length !== tasks.length) {
    storage?.setItem(buildTaskKey(input.methodCode, input.version), JSON.stringify(remaining));
    return { storedIn: "coverage", action: "removed" };
  }
  const next: CoverageTask = {
    id: `coverage-${input.ruleId}-${tasks.length + 1}`,
    ruleId: input.ruleId,
    created_at: nowIso(),
    status: "open",
    key: taskKey,
  };
  const updated = [next, ...tasks];
  storage?.setItem(buildTaskKey(input.methodCode, input.version), JSON.stringify(updated));
  return { storedIn: "coverage", action: "added" };
}
