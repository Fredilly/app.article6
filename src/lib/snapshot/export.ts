import { canonicalJsonStringify, sha256Hex } from './canonical';
import type { EvidenceSnapshot } from './types_v2';
import { buildExportConventions, resolveSnapshotExportTimestamp } from '@/lib/export/conventions';

export type SnapshotExport = {
  schema_version: 'evidence_snapshot.v2';
  exportConventions: ReturnType<typeof buildExportConventions>;
  snapshot: EvidenceSnapshot;
  exportedAt: string;
  contentSha256: string;
};

export async function buildSnapshotExport(snapshot: EvidenceSnapshot): Promise<SnapshotExport> {
  const exportedAt = resolveSnapshotExportTimestamp(snapshot);
  const payload = {
    schema_version: 'evidence_snapshot.v2' as const,
    exportConventions: buildExportConventions('evidence_snapshot'),
    snapshot,
    exportedAt,
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
