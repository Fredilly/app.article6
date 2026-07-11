import Vm0007EvidenceMapDraftPage from "@/components/preverif/Vm0007EvidenceMapDraftPage";

export default async function Page({ params }: { params: Promise<{ auditId: string }> }) {
  return <Vm0007EvidenceMapDraftPage auditId={(await params).auditId} />;
}
