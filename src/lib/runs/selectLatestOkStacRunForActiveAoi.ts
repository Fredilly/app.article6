import type { VerificationRun } from "@/lib/proofMap/types";
import selectLatestStacRun from "@/lib/runs/selectLatestStacRun";

export default function selectLatestOkStacRunForActiveAoi(input: {
  runs: VerificationRun[];
  activeAoiFingerprint: string | null;
}): VerificationRun | null {
  return selectLatestStacRun({ runs: input.runs, aoiFingerprint: input.activeAoiFingerprint });
}

