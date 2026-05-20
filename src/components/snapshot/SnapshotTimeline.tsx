'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react';
import type { EvidenceSnapshot, EvidenceSnapshotDiff } from '@/lib/snapshot';
import {
  buildSnapshot,
  buildSnapshotExport,
  computeSnapshotDiff,
  deleteSnapshot,
  downloadSnapshotExport,
  listSnapshots,
  saveSnapshot,
} from '@/lib/snapshot';
import type { Project } from '@/lib/projects/types';
import { SnapshotDiffView } from './SnapshotDiffView';

type SnapshotTimelineProps = {
  project: Project;
  onRefreshProject: () => void;
};

export function SnapshotTimeline({ project, onRefreshProject }: SnapshotTimelineProps) {
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [diff, setDiff] = useState<EvidenceSnapshotDiff | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const refreshList = useCallback(() => {
    setSnapshots(listSnapshots(project.id));
  }, [project.id]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleTakeSnapshot = async () => {
    setCreating(true);
    try {
      const snapshot = await buildSnapshot(project, newLabel || `Snapshot ${snapshots.length + 1}`, newDescription || undefined);
      saveSnapshot(snapshot);
      setNewLabel('');
      setNewDescription('');
      refreshList();
      onRefreshProject();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (snapshotId: string) => {
    deleteSnapshot(project.id, snapshotId);
    if (selectedId === snapshotId) setSelectedId(null);
    if (compareId === snapshotId) setCompareId(null);
    setDiff(null);
    refreshList();
  };

  const handleExport = async (snapshot: EvidenceSnapshot) => {
    setExportingId(snapshot.snapshotId);
    try {
      const exportData = await buildSnapshotExport(snapshot);
      downloadSnapshotExport(exportData, `snapshot-${snapshot.label.replace(/\s+/g, '-').toLowerCase()}-${snapshot.snapshotId.slice(0, 8)}.json`);
    } finally {
      setExportingId(null);
    }
  };

  const handleCompare = useCallback(async () => {
    if (!selectedId || !compareId) return;
    const left = snapshots.find((s) => s.snapshotId === selectedId);
    const right = snapshots.find((s) => s.snapshotId === compareId);
    if (!left || !right) return;

    const [older, newer] =
      new Date(left.createdAt) < new Date(right.createdAt) ? [left, right] : [right, left];
    setDiff(computeSnapshotDiff(older, newer));
  }, [selectedId, compareId, snapshots]);

  useEffect(() => {
    if (selectedId && compareId) {
      handleCompare();
    } else {
      setDiff(null);
    }
  }, [selectedId, compareId, handleCompare]);

  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [snapshots],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Evidence Snapshots</h2>
          {snapshots.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {snapshots.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-1 text-sm text-slate-500">
          Capture evidence state at key milestones. Select two snapshots to compare.
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-4">
          {project.status === 'in-progress' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="grid gap-2">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Snapshot label (e.g., Initial review, After document upload)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleTakeSnapshot}
                    disabled={creating}
                    className="flex h-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    {creating ? 'Capturing...' : 'Take Snapshot'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {ordered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No snapshots yet. Take a snapshot to capture the current evidence state.
            </div>
          ) : (
            <div className="grid gap-3">
              {ordered.map((snapshot, index) => {
                const isOlderSelected = selectedId === snapshot.snapshotId;
                const isNewerSelected = compareId === snapshot.snapshotId;
                const isSelected = isOlderSelected || isNewerSelected;

                return (
                  <div
                    key={snapshot.snapshotId}
                    className={`rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {ordered.length - index}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{snapshot.label}</div>
                          {snapshot.description && (
                            <div className="mt-0.5 text-xs text-slate-500">{snapshot.description}</div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>{new Date(snapshot.createdAt).toLocaleString()}</span>
                            <span className="font-mono">#{snapshot.fingerprint.slice(0, 12)}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                              {snapshot.state.coverage.percentComplete}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {project.status === 'in-progress' && (
                          <button
                            onClick={() => handleDelete(snapshot.snapshotId)}
                            className="rounded p-1 text-slate-400 hover:text-red-500"
                            title="Delete snapshot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExport(snapshot)}
                          disabled={exportingId === snapshot.snapshotId}
                          className="rounded p-1 text-slate-400 hover:text-blue-600"
                          title="Export snapshot"
                        >
                          <Download className={`h-4 w-4 ${exportingId === snapshot.snapshotId ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {snapshots.length >= 2 && (
                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => {
                            if (isOlderSelected) {
                              setSelectedId(null);
                            } else {
                              setSelectedId(snapshot.snapshotId);
                              if (compareId === snapshot.snapshotId) setCompareId(null);
                            }
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isOlderSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isOlderSelected ? 'Selected (older)' : 'Select as older'}
                        </button>
                        <button
                          onClick={() => {
                            if (isNewerSelected) {
                              setCompareId(null);
                            } else {
                              setCompareId(snapshot.snapshotId);
                              if (selectedId === snapshot.snapshotId) setSelectedId(null);
                            }
                          }}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            isNewerSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isNewerSelected ? 'Selected (newer)' : 'Select as newer'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {diff && selectedId && compareId && (
            <SnapshotDiffView diff={diff} />
          )}
        </div>
      )}
    </section>
  );
}
