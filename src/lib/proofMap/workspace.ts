import type { EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";

export type WorkspaceState = {
  evidencePins?: EvidencePin[] | null;
  selectedStacItemId?: string | null;
  evidenceSelections?: unknown[] | Record<string, unknown> | null;
  evidenceSnapshots?: ProofEvidenceItem[] | null;
  selectedItems?: unknown[] | Record<string, unknown> | null;
  verificationRuns?: VerificationRun[] | null;
};

type WorkspaceWorkFlags = {
  hasPins: boolean;
  hasSelections: boolean;
  hasRuns: boolean;
  willClearWork: boolean;
};

function hasCollection(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

export function getWorkspaceWorkFlags(workspace: WorkspaceState): WorkspaceWorkFlags {
  const hasPins = (workspace.evidencePins ?? []).length > 0;
  const hasSelections =
    Boolean(workspace.selectedStacItemId) ||
    hasCollection(workspace.evidenceSelections) ||
    hasCollection(workspace.selectedItems) ||
    (workspace.evidenceSnapshots ?? []).length > 0;
  const hasRuns = (workspace.verificationRuns ?? []).length > 0;
  return { hasPins, hasSelections, hasRuns, willClearWork: hasPins || hasSelections || hasRuns };
}
