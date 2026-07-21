import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const pdf = buildMarcondesPreValidationPdf(buildMarcondesPreValidationReadinessReport());
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="marcondes-vm0007-v18-prevalidation-readiness-report.pdf"', "Cache-Control": "no-store" } });
}
