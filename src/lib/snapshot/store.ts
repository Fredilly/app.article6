import type { EvidenceSnapshot } from './types_v2';

function storageKey(projectId: string): string {
  return `article6_snapshots:${projectId}`;
}

function loadAll(projectId: string): EvidenceSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? (JSON.parse(raw) as EvidenceSnapshot[]) : [];
  } catch {
    return [];
  }
}

function saveAll(projectId: string, snapshots: EvidenceSnapshot[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(projectId), JSON.stringify(snapshots));
}

export function listSnapshots(projectId: string): EvidenceSnapshot[] {
  return loadAll(projectId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getSnapshot(projectId: string, snapshotId: string): EvidenceSnapshot | undefined {
  return loadAll(projectId).find((s) => s.snapshotId === snapshotId);
}

export function saveSnapshot(snapshot: EvidenceSnapshot): void {
  const all = loadAll(snapshot.projectId);
  const idx = all.findIndex((s) => s.snapshotId === snapshot.snapshotId);
  if (idx >= 0) {
    all[idx] = snapshot;
  } else {
    all.push(snapshot);
  }
  saveAll(snapshot.projectId, all);
}

export function deleteSnapshot(projectId: string, snapshotId: string): void {
  const all = loadAll(projectId).filter((s) => s.snapshotId !== snapshotId);
  saveAll(projectId, all);
}

export function deleteAllSnapshots(projectId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(projectId));
}
