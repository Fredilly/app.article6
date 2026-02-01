import { addTaskWithText, buildVerifyRunKey, normalizeMethodCode, normalizeVersion, persistVerifierRunBundle, readVerifierRunBundle } from "@/lib/verify/runState";

export type CoverageTask = {
  id: string;
  ruleId: string;
  created_at: string;
  status: "open" | "done";
};

const taskPrefix = "a6:coverage:tasks";

function nowIso(): string {
  return new Date().toISOString();
}

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return null;
}

function buildTaskKey(methodCode: string, version: string): string {
  const method = normalizeMethodCode(methodCode);
  const ver = normalizeVersion(version);
  return `${taskPrefix}:${method}:${ver}`;
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

export function addCoverageTask(input: { methodCode: string; version: string; ruleId: string }): { storedIn: "verify" | "coverage" } {
  const storage = getStorage();
  const verifyKey = buildVerifyRunKey(input.methodCode, input.version);
  const hasVerifyBundle = storage ? Boolean(storage.getItem(verifyKey)) : false;

  if (hasVerifyBundle) {
    const bundle = readVerifierRunBundle(input.methodCode, input.version);
    const task = addTaskWithText(`Coverage: ${input.ruleId}`);
    const next = { ...bundle, tasks: [...bundle.tasks, task] };
    persistVerifierRunBundle(input.methodCode, input.version, next);
    return { storedIn: "verify" };
  }

  const tasks = loadCoverageTasks(input.methodCode, input.version);
  const next: CoverageTask = {
    id: `coverage-${input.ruleId}-${tasks.length + 1}`,
    ruleId: input.ruleId,
    created_at: nowIso(),
    status: "open",
  };
  const updated = [next, ...tasks];
  storage?.setItem(buildTaskKey(input.methodCode, input.version), JSON.stringify(updated));
  return { storedIn: "coverage" };
}
