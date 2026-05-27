'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project } from '@/lib/projects/types';
import { listProjects, getProjectCoverage, deleteProject } from '@/lib/projects/storage';
import { listReviewWorkspacesForProject } from '@/lib/reviewWorkspaces/storage';
import { buildProjectReviewHref } from '@/lib/projects/reviewHandoff';

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  const handleDelete = (id: string) => {
    deleteProject(id);
    setProjects(listProjects());
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Long-lived readiness workspace for evidence, rule references, and gap follow-up</p>
        </div>
        <Link
          href="/start-review"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Open Quick Check
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">No readiness workspaces yet. Create one to start tracking evidence gaps and follow-up.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map(project => {
            const coverage = getProjectCoverage(project);
            const latestWorkspace = project.reviewMode === 'methodology-linked'
              ? listReviewWorkspacesForProject(project.id)[0] ?? null
              : null;
            const startReviewHref = project.reviewMode === 'methodology-linked' && project.methodCode && project.methodVersion
              ? buildProjectReviewHref({
                  methodCode: project.methodCode,
                  methodVersion: project.methodVersion,
                  projectId: project.id,
                  workspaceId: latestWorkspace?.id ?? project.lastWorkspaceId ?? null,
                })
              : `/m?projectId=${encodeURIComponent(project.id)}`;
            return (
              <div
                key={project.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {project.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {project.reviewMode === 'manual' ? 'Evidence-led readiness' : 'Methodology-linked readiness'}
                      </span>
                      {project.reviewMode === 'methodology-linked' && project.methodCode && project.methodVersion ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                          {project.methodCode}@{project.methodVersion}
                        </span>
                      ) : null}
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          project.status === 'locked'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {project.status === 'locked' ? 'snapshot locked' : 'needs follow-up'}
                      </span>
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                    {project.aoiLabel && (
                      <p className="mt-1 text-xs text-slate-400">AOI: {project.aoiLabel}</p>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold text-slate-900">{coverage.percentComplete}%</div>
                    <div className="text-xs text-slate-500">
                      {coverage.verified + coverage.gap}/{coverage.total - coverage.notApplicable} readiness items touched
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${coverage.percentComplete}%` }}
                    />
                  </div>
                  <div className="mt-1 flex gap-3 text-xs text-slate-400">
                    <span>{coverage.verified} {project.reviewMode === 'manual' ? 'closed' : 'ready'}</span>
                    <span>{coverage.gap} {project.reviewMode === 'manual' ? 'open' : 'needs follow-up'}</span>
                    <span>{coverage.inProgress} {project.reviewMode === 'manual' ? 'in review' : 'weak support'}</span>
                    {project.reviewMode === 'methodology-linked' ? <span>{coverage.notStarted} pending</span> : null}
                    {coverage.notApplicable > 0 && <span>{coverage.notApplicable} n/a</span>}
                  </div>
                </div>

                {project.status === 'in-progress' && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {project.reviewMode === 'methodology-linked' ? (
                        <>
                          <Link
                            href={startReviewHref}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                          >
                            Open readiness workspace
                          </Link>
                          {(() => {
                            if (!latestWorkspace) return null;
                            return (
                              <Link
                                href={buildProjectReviewHref({
                                  methodCode: latestWorkspace.methodCode,
                                  methodVersion: latestWorkspace.methodVersion,
                                  projectId: project.id,
                                  workspaceId: latestWorkspace.id,
                                })}
                                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                              >
                                Continue readiness workspace
                              </Link>
                            );
                          })()}
                        </>
                      ) : null}
                    </div>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
