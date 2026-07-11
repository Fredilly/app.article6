"use client";

import { useEffect, useState } from "react";
import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import {
  createProjectReadinessReportViewModel,
  loadProjectReadinessPayload,
  PROJECT_READINESS_PAYLOAD_EVENT,
  type ProjectReadinessPayloadEventDetail,
} from "@/lib/evidence/projectReadinessPayload";
import type { ReadinessReportViewModel } from "@/lib/evidence/readinessReport";

type Props = Readonly<{ projectId: string }>;

const NOT_ASSESSED = createProjectReadinessReportViewModel(null);

export default function ProjectPreValidationReadinessReport({ projectId }: Props) {
  const [report, setReport] = useState<ReadinessReportViewModel>(NOT_ASSESSED);

  useEffect(() => {
    const load = () => setReport(createProjectReadinessReportViewModel(loadProjectReadinessPayload(projectId)));
    const handlePayloadEvent = (event: Event) => {
      const detail = (event as CustomEvent<ProjectReadinessPayloadEventDetail>).detail;
      if (!detail || detail.projectId !== projectId) return;
      setReport(detail.state === "cleared" ? NOT_ASSESSED : createProjectReadinessReportViewModel(loadProjectReadinessPayload(projectId)));
    };
    load();
    window.addEventListener(PROJECT_READINESS_PAYLOAD_EVENT, handlePayloadEvent);
    return () => window.removeEventListener(PROJECT_READINESS_PAYLOAD_EVENT, handlePayloadEvent);
  }, [projectId]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8" data-testid="project-pre-validation-readiness-report">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pre-Validation Readiness Report</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Project readiness report</h1>
          <div className="mt-1 text-sm text-slate-600">Project ID: {projectId} · Real finalized presentation payload only</div>
        </header>
        <PreValidationReadinessReviewer report={report} />
      </div>
    </main>
  );
}
