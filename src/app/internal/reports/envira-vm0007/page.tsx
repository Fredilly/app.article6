import type { Metadata } from "next";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

export const metadata: Metadata = {
  title: "Internal Envira VM0007 Fixture-Backed Report | app.article6",
  description: "Internal Envira VM0007 fixture-backed report and evidence map preview.",
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
