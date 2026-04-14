'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import { listProjects, getProjectCoverage, deleteProject } from '@/lib/projects/storage';

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
          <p className="mt-1 text-sm text-slate-500">Methodology verification workbench</p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">No projects yet. Create one to start a verification.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map(project => {
            const coverage = getProjectCoverage(project);
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
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">
                        {project.methodCode}@{project.methodVersion}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          project.status === 'finalized'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {project.status}
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
                      {coverage.verified}/{coverage.total - coverage.notApplicable} rules
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
                    <span>{coverage.verified} verified</span>
                    <span>{coverage.gap} gaps</span>
                    <span>{coverage.notStarted} pending</span>
                    {coverage.notApplicable > 0 && <span>{coverage.notApplicable} n/a</span>}
                  </div>
                </div>

                {project.status === 'in-progress' && (
                  <div className="mt-3 flex justify-end">
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
