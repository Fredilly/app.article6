import { buildClientReadinessReportExport } from "@/lib/readiness/clientReadinessExport";
import type { ClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asClientReadinessReport(value: unknown): ClientReadinessReport | null {
  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.reportId !== "string" || !record.reportId.trim()) return null;
  const appendix = asRecord(record.technicalAppendix);
  if (!appendix || typeof appendix.generatedAt !== "string" || !appendix.generatedAt.trim()) return null;
  return value as ClientReadinessReport;
}

function asReadinessGaps(value: unknown): RuleReadinessGap[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.every((item) => {
    const record = asRecord(item);
    return Boolean(record && typeof record.ruleId === "string" && typeof record.state === "string" && typeof record.severity === "string");
  });
  return valid ? (value as RuleReadinessGap[]) : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const record = asRecord(body) ?? {};
    const report = asClientReadinessReport(record.report);
    const readinessGaps = asReadinessGaps(record.readinessGaps);

    if (!report) return new Response("Missing or invalid report payload", { status: 400 });
    if (!readinessGaps) return new Response("Missing or invalid readinessGaps payload", { status: 400 });

    const { zipBytes } = buildClientReadinessReportExport({ report, readinessGaps });
    return new Response(new Uint8Array(zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="client-readiness-report.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Client readiness report export failed (500). ${message}`, { status: 500 });
  }
}
