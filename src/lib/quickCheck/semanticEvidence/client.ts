import type { SemanticEvidenceCandidate, SemanticEvidenceStatus } from "@/lib/quickCheck/retrieval/types";

export type SemanticEvidenceResponse = {
  status: SemanticEvidenceStatus;
  candidates: SemanticEvidenceCandidate[];
  warning?: string;
};

export async function fetchSemanticEvidenceCandidates(input: {
  claimText: string;
  rawPddText: string;
  methodologyId: string;
  methodologyVersion: string;
}): Promise<SemanticEvidenceResponse> {
  const response = await fetch("/api/quick-check/semantic-evidence", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Semantic evidence request failed with ${response.status}`);
  }
  return response.json() as Promise<SemanticEvidenceResponse>;
}
