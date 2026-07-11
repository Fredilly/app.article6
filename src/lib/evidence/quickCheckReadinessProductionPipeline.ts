import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import {
  finalizeEvidenceMapForReadiness,
  type EvidenceMapAssessment,
  type ProjectReadinessPipelineResult,
} from "@/lib/evidence/projectReadinessProductionPipeline";
import {
  clearQuickCheckReadinessPayload,
  saveQuickCheckReadinessPayload,
} from "@/lib/evidence/quickCheckReadinessPayload";

/**
 * Quick Check may supply only an already-finalized Evidence Map. The audit
 * record is deliberately not adapted into Evidence Map rows here.
 */
export function finalizeQuickCheckEvidenceMapForReadiness(input: Readonly<{
  auditId: string;
  auditGeneratedAt: string;
  rows: readonly EvidenceMapRow[];
  assessments: readonly EvidenceMapAssessment[];
}>): ProjectReadinessPipelineResult {
  return finalizeEvidenceMapForReadiness({
    rows: input.rows,
    assessments: input.assessments,
    storageScope: {
      id: input.auditId,
      save: (gateResult) => saveQuickCheckReadinessPayload({ auditId: input.auditId, auditGeneratedAt: input.auditGeneratedAt, gateResult }),
      clear: () => { clearQuickCheckReadinessPayload(input.auditId); },
    },
  });
}
