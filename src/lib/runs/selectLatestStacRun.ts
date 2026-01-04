import type { VerificationRun } from "@/lib/proofMap/types";

export default function selectLatestStacRun(input: {
  runs: VerificationRun[];
  aoiFingerprint: string | null;
}): VerificationRun | null {
  if (!input.aoiFingerprint) return null;

  const candidates = (input.runs ?? []).filter(
    (run) => run.provider === "stac" && run.status === "ok" && run.aoi_fingerprint === input.aoiFingerprint,
  );
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const aTime = Date.parse(a.ended_at ?? a.created_at);
    const bTime = Date.parse(b.ended_at ?? b.created_at);
    const aScore = Number.isFinite(aTime) ? aTime : 0;
    const bScore = Number.isFinite(bTime) ? bTime : 0;
    return bScore - aScore;
  });

  return candidates[0] ?? null;
}

