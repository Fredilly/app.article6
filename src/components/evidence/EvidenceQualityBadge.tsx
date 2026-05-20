'use client';

import type { QualityGrade } from '@/lib/evidence/metrics';

const GRADE_META: Record<QualityGrade, { label: string; color: string; bg: string; border: string }> = {
  A: { label: 'A', color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  B: { label: 'B', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  C: { label: 'C', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  D: { label: 'D', color: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200' },
};

type EvidenceQualityBadgeProps = {
  grade: QualityGrade;
  score: number;
};

export default function EvidenceQualityBadge({ grade, score }: EvidenceQualityBadgeProps) {
  const meta = GRADE_META[grade];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color} ${meta.bg} ${meta.border}`}
      title={`Quality score: ${(score * 100).toFixed(0)}%`}
    >
      Quality {meta.label}
    </span>
  );
}

export function SectionCoverageBar({
  sectionTitle,
  coverageFraction,
  totalRules,
}: {
  sectionTitle: string;
  coverageFraction: number;
  totalRules: number;
}) {
  const pct = Math.round(coverageFraction * 100);
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span className="truncate font-medium" title={sectionTitle}>
          {sectionTitle.length > 30 ? sectionTitle.slice(0, 30) + '…' : sectionTitle}
        </span>
        <span className="ml-2 shrink-0 tabular-nums">
          {Math.round(coverageFraction * totalRules)}/{totalRules}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
