import { NextResponse } from "next/server";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import { buildEnviraVm0007FixtureBackedPdf } from "@/lib/preverif/enviraVm0007FixtureBackedPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = buildEnviraVm0007FixtureBackedReport();
    const pdf = buildEnviraVm0007FixtureBackedPdf(report);
    const bytes = new Uint8Array(pdf);
    const blob = new Blob([bytes], { type: "application/pdf" });

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="internal-envira-vm0007-fixture-backed-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Envira fixture-backed PDF export failed", detail: String(error) },
      { status: 500 },
    );
  }
}
