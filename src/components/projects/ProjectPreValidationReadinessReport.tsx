"use client";

import { useEffect, useState } from "react";
import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import { createProjectReadinessReportViewModel, loadProjectReadinessPayload } from "@/lib/evidence/projectReadinessPayload";
import { getProject } from "@/lib/projects/storage";
import type { Project } from "@/lib/projects/types";
import type { ReadinessReportViewModel } from "@/lib/evidence/readinessReport";

type Props = Readonly<{ projectId: string }>;

const NOT_ASSESSED = createProjectReadinessReportViewModel(null);

export default function ProjectPreValidationReadinessReport({ projectId }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [report, setReport] = useState<ReadinessReportViewModel>(NOT_ASSESSED);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadedProject = getProject(projectId);
    const payload = loadProjectReadinessPayload(projectId);
    setProject(loadedProject ?? null);
    setReport(createProjectReadinessReportViewModel(payload));
  }, [projectId]);

  const recordPreviewAction = (action: string, rowId: string) => {
    setActionMessage(`${action} requested for ${rowId}. This production wiring preview does not persist reviewer changes.`);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="project-pre-validation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-Validation Readiness Report</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{project?.name ?? "Project readiness report"}</h1>
          <div className="mt-1 text-sm text-slate-600">Project ID: {projectId} · Real finalized presentation payload only</div>
        </header>
        <PreValidationReadinessReviewer
          report={report}
          onApprove={(rowId) => recordPreviewAction("Approve", rowId)}
          onEdit={(rowId) => recordPreviewAction("Edit", rowId)}
          onReopen={(rowId) => recordPreviewAction("Reopen", rowId)}
        />
        {actionMessage ? <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900" data-testid="project-readiness-action-status">{actionMessage}</p> : null}
      </div>
    </main>
  );
}
