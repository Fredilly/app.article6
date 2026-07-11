import type { Metadata } from "next";
import QuickCheckPreValidationReadinessReport from "@/components/projects/QuickCheckPreValidationReadinessReport";

export const metadata: Metadata = {
  title: "Quick Check Pre-Validation Readiness Report | app.article6",
  description: "Quick Check readiness report from canonical project Evidence Map data.",
};

export default async function QuickCheckPreValidationReadinessPage({
  searchParams,
}: {
  searchParams?: Promise<{ auditId?: string | string[] }>;
}) {
  const params = await searchParams;
  const auditId = Array.isArray(params?.auditId) ? params.auditId[0] : params?.auditId;
  return <QuickCheckPreValidationReadinessReport auditId={auditId?.trim() || null} />;
}
