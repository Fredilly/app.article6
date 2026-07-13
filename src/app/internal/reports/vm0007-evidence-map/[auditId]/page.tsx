import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";
import {
  loadReviewedEvidenceMapCandidate,
  loadReviewedEvidenceMapCandidates,
} from "@/lib/preverif/reviewedEvidenceMapServerRegistry";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams?: Promise<{
    sourcePdfSha256?: string | string[];
    sourceDocumentId?: string | string[];
    stableProjectId?: string | string[];
  }>;
}) {
  const auditId = (await params).auditId;
  const query = (await searchParams) ?? {};
  const value = (input: string | string[] | undefined) =>
    Array.isArray(input) ? input[0] : input;
  return (
    <Vm0007EvidenceMapDraftPage
      auditId={auditId}
      reviewedCandidate={loadReviewedEvidenceMapCandidate({
        sourcePdfSha256: value(query.sourcePdfSha256),
        sourceDocumentId: value(query.sourceDocumentId),
        stableProjectId: value(query.stableProjectId),
      })}
      reviewedCandidates={loadReviewedEvidenceMapCandidates()}
    />
  );
}
