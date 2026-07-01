import type { Metadata } from "next";
import Vm0007GapReportPreview from "@/components/preverif/Vm0007GapReportPreview";

export const metadata: Metadata = {
  title: "VM0007 Gap Report Preview | app.article6",
  description: "Internal VM0007 validation readiness gap report preview for manual PDF export.",
};

export default async function Vm0007GapReportPreviewPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  return <Vm0007GapReportPreview auditId={auditId} />;
}
