'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project, RuleReview, ProjectCoverage } from '@/lib/projects/types';
import { getProject, updateRuleReview, finalizeProject, getProjectCoverage } from '@/lib/projects/storage';

type ProjectDetailProps = {
  projectId: string;
};

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [coverage, setCoverage] = useState<ProjectCoverage | null>(null);

  useEffect(() => {
    const p = getProject(projectId);
    if (p) {
      setProject(p);
      setCoverage(getProjectCoverage(p));
    }
  }, [projectId]);

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-slate-500">Project not found.</p>
        <Link href="/projects" className="mt-2 text-sm text-blue-600 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }

  const handleStatusChange = (ruleId: string, status: RuleReview['status']) => {
    const updated = updateRuleReview(projectId, ruleId, { status });
    if (updated) {
      setProject(updated);
      setCoverage(getProjectCoverage(updated));
    }
  };

  const handleFinalize = () => {
    const finalized = finalizeProject(projectId);
    if (finalized) {
      setProject(finalized);
    }
  };

  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 md:px-8">
      <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
              {project.methodCode}@{project.methodVersion}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                project.status === 'finalized'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {project.status}
            </span>
          </div>
          {project.aoiLabel && <p className="mt-1 text-sm text-slate-400">AOI: {project.aoiLabel}</p>}
        </div>

        {project.status === 'in-progress' && coverage && coverage.notStarted < coverage.total && (
          <button
            onClick={handleFinalize}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Finalize Project
          </button>
        )}
      </div>

      {coverage && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Verified', value: coverage.verified, color: 'text-green-600' },
            { label: 'Gaps', value: coverage.gap, color: 'text-red-600' },
            { label: 'In Progress', value: coverage.inProgress, color: 'text-amber-600' },
            { label: 'Pending', value: coverage.notStarted, color: 'text-slate-400' },
            { label: 'N/A', value: coverage.notApplicable, color: 'text-slate-300' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {coverage && (
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${coverage.percentComplete}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-slate-500">{coverage.percentComplete}% complete</p>
        </div>
      )}

      {Object.entries(grouped).map(([sectionId, reviews]) => (
        <div key={sectionId} className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-700">{sectionId}</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {reviews.map(review => (
              <div key={review.ruleId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{review.ruleTitle}</div>
                  <div className="text-xs text-slate-400 font-mono">{review.ruleId}</div>
                </div>
                {project.status === 'in-progress' ? (
                  <select
                    value={review.status}
                    onChange={e => handleStatusChange(review.ruleId, e.target.value as RuleReview['status'])}
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      review.status === 'verified'
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : review.status === 'gap'
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : review.status === 'not-applicable'
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="verified">Verified</option>
                    <option value="gap">Gap</option>
                    <option value="not-applicable">N/A</option>
                  </select>
                ) : (
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      review.status === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : review.status === 'gap'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {review.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
