import type { Metadata } from "next";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

export const metadata: Metadata = {
  title: "Envira VM0007 legacy v1.5 mismatch | app.article6",
  description: "Quarantined Envira VM0007 legacy v1.5 mismatch regression fixture and evidence map preview.",
};

export default function EnviraVm0007FixtureBackedReportPage() {
  const report = buildEnviraVm0007FixtureBackedReport();
  return (
    <FixtureBackedVm0007ReportView
      report={report}
      pdfDownloadHref="/api/exports/internal/envira-vm0007-report"
    />
  );
}
