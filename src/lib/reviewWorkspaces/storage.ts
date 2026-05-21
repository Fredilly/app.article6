import type { ReviewWorkspace } from "@/lib/reviewWorkspaces/types";

const STORAGE_KEY = "article6_review_workspaces";

function generateId(): string {
  return "ws_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeWorkspace(value: unknown): ReviewWorkspace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = normalizeTrimmed(record.id);
  const projectId = normalizeTrimmed(record.projectId);
  const methodCode = normalizeTrimmed(record.methodCode);
  const methodVersion = normalizeTrimmed(record.methodVersion);
  const createdAt = normalizeTrimmed(record.createdAt);
  const updatedAt = normalizeTrimmed(record.updatedAt);
  if (!id || !projectId || !methodCode || !methodVersion || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    name: normalizeTrimmed(record.name) ?? `${methodCode} ${methodVersion} review`,
    projectId,
    methodCode,
    methodVersion,
    reportingPeriod: normalizeTrimmed(record.reportingPeriod),
    status: record.status === "finalized" ? "finalized" : "draft",
    createdAt,
    updatedAt,
    lastOpenedAt: normalizeTrimmed(record.lastOpenedAt),
    finalizedAt: normalizeTrimmed(record.finalizedAt),
  };
}

function loadAll(): ReviewWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeWorkspace(item))
      .filter((item): item is ReviewWorkspace => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function saveAll(workspaces: ReviewWorkspace[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
}

export function listReviewWorkspaces(): ReviewWorkspace[] {
  return loadAll();
}

export function getReviewWorkspace(id: string): ReviewWorkspace | undefined {
  return loadAll().find((workspace) => workspace.id === id);
}

export function listReviewWorkspacesForProject(projectId: string): ReviewWorkspace[] {
  return loadAll().filter((workspace) => workspace.projectId === projectId);
}

export function findReviewWorkspaceByProjectAndMethod(
  projectId: string,
  methodCode: string,
  methodVersion: string,
): ReviewWorkspace | undefined {
  const normalizedCode = methodCode.trim();
  const normalizedVersion = methodVersion.trim();
  return loadAll().find(
    (workspace) =>
      workspace.projectId === projectId &&
      workspace.methodCode === normalizedCode &&
      workspace.methodVersion === normalizedVersion,
  );
}

export function createReviewWorkspace(input: {
  name: string;
  projectId: string;
  methodCode: string;
  methodVersion: string;
  reportingPeriod?: string;
}): ReviewWorkspace {
  const now = new Date().toISOString();
  const workspace: ReviewWorkspace = {
    id: generateId(),
    name: input.name.trim(),
    projectId: input.projectId,
    methodCode: input.methodCode.trim(),
    methodVersion: input.methodVersion.trim(),
    reportingPeriod: input.reportingPeriod?.trim() || undefined,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
  const all = loadAll();
  all.push(workspace);
  saveAll(all);
  return workspace;
}

export function ensureReviewWorkspace(input: {
  projectId: string;
  projectName: string;
  projectCode?: string;
  methodCode: string;
  methodVersion: string;
  reportingPeriod?: string;
}): ReviewWorkspace {
  const existing = findReviewWorkspaceByProjectAndMethod(input.projectId, input.methodCode, input.methodVersion);
  if (existing) {
    return updateReviewWorkspace(existing.id, {
      lastOpenedAt: new Date().toISOString(),
      reportingPeriod: input.reportingPeriod ?? existing.reportingPeriod,
      name:
        existing.name ||
        buildReviewWorkspaceName({
          projectName: input.projectName,
          projectCode: input.projectCode,
          methodCode: input.methodCode,
          methodVersion: input.methodVersion,
        }),
    }) ?? existing;
  }
  return createReviewWorkspace({
    projectId: input.projectId,
    methodCode: input.methodCode,
    methodVersion: input.methodVersion,
    reportingPeriod: input.reportingPeriod,
    name: buildReviewWorkspaceName({
      projectName: input.projectName,
      projectCode: input.projectCode,
      methodCode: input.methodCode,
      methodVersion: input.methodVersion,
    }),
  });
}

export function updateReviewWorkspace(
  workspaceId: string,
  update: Partial<Omit<ReviewWorkspace, "id" | "projectId" | "methodCode" | "methodVersion" | "createdAt">>,
): ReviewWorkspace | undefined {
  const all = loadAll();
  const workspace = all.find((item) => item.id === workspaceId);
  if (!workspace) return undefined;
  Object.assign(workspace, {
    ...update,
    updatedAt: new Date().toISOString(),
  });
  saveAll(all);
  return workspace;
}

export function touchReviewWorkspace(workspaceId: string): ReviewWorkspace | undefined {
  return updateReviewWorkspace(workspaceId, { lastOpenedAt: new Date().toISOString() });
}

export function buildReviewWorkspaceName(input: {
  projectName: string;
  projectCode?: string;
  methodCode: string;
  methodVersion: string;
}): string {
  const projectLabel = input.projectCode?.trim()
    ? `${input.projectName.trim()} (${input.projectCode.trim()})`
    : input.projectName.trim();
  return `${projectLabel} · ${input.methodCode.trim()} ${input.methodVersion.trim()} review`;
}
