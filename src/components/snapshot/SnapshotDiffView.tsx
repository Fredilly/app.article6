'use client';

import { ArrowLeftRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { EvidenceSnapshotDiff, SnapshotDiffItem } from '@/lib/snapshot';

type SnapshotDiffViewProps = {
  diff: EvidenceSnapshotDiff;
};

type SectionKey = 'reviews' | 'documents' | 'findings' | 'extractedDrafts' | 'decisions' | 'evidencePins' | 'verificationRuns';

const SECTION_LABELS: Record<SectionKey, string> = {
  reviews: 'Rule Reviews',
  documents: 'Documents',
  findings: 'Manual Findings',
  extractedDrafts: 'Extracted Drafts',
  decisions: 'Reviewer Decisions',
  evidencePins: 'Evidence Pins',
  verificationRuns: 'Verification Runs',
};

function kindBadge(kind: SnapshotDiffItem['kind']): { label: string; className: string } {
  switch (kind) {
    case 'added':
      return { label: 'Added', className: 'bg-green-100 text-green-700' };
    case 'removed':
      return { label: 'Removed', className: 'bg-red-100 text-red-700' };
    case 'changed':
      return { label: 'Changed', className: 'bg-amber-100 text-amber-700' };
  }
}

function DiffValue({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  const display = typeof value === 'string' ? value : JSON.stringify(value);
  if (!display) return null;
  return (
    <div className="text-xs">
      <span className="font-medium text-slate-500">{label}: </span>
      <span className="text-slate-700">{display}</span>
    </div>
  );
}

function DiffItemCard({ item }: { item: SnapshotDiffItem }) {
  const badge = kindBadge(item.kind);
  const [expanded, setExpanded] = useState(false);
  const hasDetails = (item.left && Object.keys(item.left).length > 0) || (item.right && Object.keys(item.right).length > 0);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-sm font-medium text-slate-800">{item.label}</span>
          <span className="font-mono text-[11px] text-slate-400">{item.id.slice(0, 16)}</span>
        </div>
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2">
          {item.left && (
            <div className="rounded-lg bg-red-50 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-red-600">Before</div>
              {Object.entries(item.left).map(([key, value]) => (
                <DiffValue key={key} label={key} value={value} />
              ))}
            </div>
          )}
          {item.right && (
            <div className="rounded-lg bg-green-50 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-green-600">After</div>
              {Object.entries(item.right).map(([key, value]) => (
                <DiffValue key={key} label={key} value={value} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffSection({ diff, sectionKey }: { diff: EvidenceSnapshotDiff; sectionKey: SectionKey }) {
  const items = diff.details[sectionKey];
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">{SECTION_LABELS[sectionKey]}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {items.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <DiffItemCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SnapshotDiffView({ diff }: SnapshotDiffViewProps) {
  const { summary } = diff;
  const totalChanges =
    summary.reviewsAdded +
    summary.reviewsRemoved +
    summary.reviewsChanged +
    summary.documentsAdded +
    summary.documentsRemoved +
    summary.findingsAdded +
    summary.findingsRemoved +
    summary.findingsChanged +
    summary.extractedDraftsAdded +
    summary.extractedDraftsRemoved +
    summary.extractedDraftsChanged +
    summary.decisionsChanged +
    summary.evidencePinsAdded +
    summary.evidencePinsRemoved +
    summary.verificationRunsAdded +
    summary.verificationRunsRemoved;

  if (totalChanges === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <ArrowLeftRight className="mx-auto h-8 w-8 text-green-400" />
        <p className="mt-2 text-sm font-medium text-green-700">No changes detected</p>
        <p className="mt-1 text-xs text-green-600">
          {diff.leftLabel} → {diff.rightLabel} are identical
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-blue-800">
            Comparing: {diff.leftLabel} → {diff.rightLabel}
          </h3>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
          <SummaryStat
            label="Added"
            value={summary.reviewsAdded + summary.documentsAdded + summary.findingsAdded + summary.extractedDraftsAdded + summary.evidencePinsAdded + summary.verificationRunsAdded}
            color="text-green-600"
          />
          <SummaryStat
            label="Removed"
            value={summary.reviewsRemoved + summary.documentsRemoved + summary.findingsRemoved + summary.extractedDraftsRemoved + summary.evidencePinsRemoved + summary.verificationRunsRemoved}
            color="text-red-600"
          />
          <SummaryStat
            label="Changed"
            value={summary.reviewsChanged + summary.findingsChanged + summary.extractedDraftsChanged + summary.decisionsChanged}
            color="text-amber-600"
          />
          <SummaryStat
            label="Coverage"
            value={`${summary.coverageChange.leftPercent}% → ${summary.coverageChange.rightPercent}%`}
            color={
              summary.coverageChange.rightPercent > summary.coverageChange.leftPercent
                ? 'text-green-600'
                : summary.coverageChange.rightPercent < summary.coverageChange.leftPercent
                  ? 'text-red-600'
                  : 'text-slate-600'
            }
          />
          <SummaryStat
            label="Pins"
            value={`${summary.evidencePinsAdded - summary.evidencePinsRemoved > 0 ? '+' : ''}${summary.evidencePinsAdded - summary.evidencePinsRemoved}`}
            color={
              summary.evidencePinsAdded > summary.evidencePinsRemoved
                ? 'text-green-600'
                : summary.evidencePinsRemoved > summary.evidencePinsAdded
                  ? 'text-red-600'
                  : 'text-slate-600'
            }
          />
        </div>
      </div>

      <DiffSection diff={diff} sectionKey="reviews" />
      <DiffSection diff={diff} sectionKey="documents" />
      <DiffSection diff={diff} sectionKey="findings" />
      <DiffSection diff={diff} sectionKey="extractedDrafts" />
      <DiffSection diff={diff} sectionKey="decisions" />
      <DiffSection diff={diff} sectionKey="evidencePins" />
      <DiffSection diff={diff} sectionKey="verificationRuns" />
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg bg-white p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
