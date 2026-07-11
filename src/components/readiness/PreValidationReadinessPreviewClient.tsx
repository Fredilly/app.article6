"use client";

import { useState } from "react";
import PreValidationReadinessReviewer from "@/components/readiness/PreValidationReadinessReviewer";
import type { ReadinessReportViewModel, ReviewerWorkflowState } from "@/lib/evidence/readinessReport";

type Props = Readonly<{
  report: ReadinessReportViewModel;
  workflowState?: ReviewerWorkflowState;
}>;

export default function PreValidationReadinessPreviewClient({ report, workflowState }: Props) {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const record = (action: string, rowId: string) => setLastAction(`${action} requested for ${rowId}. Preview actions are not persisted.`);
  return (
    <>
      <PreValidationReadinessReviewer
        report={report}
        workflowState={workflowState}
        onApprove={(rowId) => record("Approve", rowId)}
        onEdit={(rowId) => record("Edit", rowId)}
        onReopen={(rowId) => record("Reopen", rowId)}
      />
      {lastAction ? <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900" data-testid="preview-action-status">{lastAction}</p> : null}
    </>
  );
}
