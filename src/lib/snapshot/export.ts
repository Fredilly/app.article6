import { canonicalJsonStringify, sha256Hex } from './canonical';
import type { EvidenceSnapshot } from './types';

export type SnapshotExport = {
  schema_version: 'evidence_snapshot.v1';
  snapshot: EvidenceSnapshot;
  exportedAt: string;
  contentSha256: string;
};

export async function buildSnapshotExport(snapshot: EvidenceSnapshot): Promise<SnapshotExport> {
  const payload = {
    schema_version: 'evidence_snapshot.v1' as const,
    snapshot,
    exportedAt: new Date().toISOString(),
  };

  const json = canonicalJsonStringify(payload);
  const contentSha256 = await sha256Hex(json);

  return { ...payload, contentSha256 };
}

export function snapshotExportJson(exportData: SnapshotExport): string {
  return JSON.stringify(exportData, null, 2);
}

export function downloadSnapshotExport(exportData: SnapshotExport, filename?: string): void {
  const json = snapshotExportJson(exportData);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `evidence-snapshot-${exportData.snapshot.snapshotId.slice(0, 12)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
