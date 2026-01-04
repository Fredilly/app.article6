import type { VerificationRun } from "@/lib/proofMap/types";

export default function selectRunsForAoi(input: {
  runs: VerificationRun[];
  aoiFingerprint: string | null;
  aoiId: string | null;
}): VerificationRun[] {
  const aoiFingerprint = input.aoiFingerprint?.trim() || null;
  const aoiId = input.aoiId?.trim() || null;
  if (!aoiFingerprint && !aoiId) return input.runs ?? [];

  if (aoiFingerprint) {
    return (input.runs ?? []).filter((run) => run.aoi_fingerprint === aoiFingerprint);
  }
  if (aoiId) {
    return (input.runs ?? []).filter((run) => run.aoi_id && run.aoi_id === aoiId);
  }
  return input.runs ?? [];
}
