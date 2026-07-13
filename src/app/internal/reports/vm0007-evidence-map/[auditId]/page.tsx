import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";
import { loadReviewedEvidenceMapCandidate } from "@/lib/preverif/reviewedEvidenceMapServerRegistry";

export default async function Page({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const auditId = (await params).auditId;
  return (
    <Vm0007EvidenceMapDraftPage
      auditId={auditId}
      reviewedCandidate={loadReviewedEvidenceMapCandidate(auditId)}
    />
  );
}
