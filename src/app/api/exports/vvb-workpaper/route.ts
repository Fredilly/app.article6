import { buildVvbWorkpaperExport } from "@/lib/readiness/vvbWorkpaperExport";
import type { VvbWorkpaperReport } from "@/lib/readiness/vvbWorkpaperReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asVvbWorkpaperReport(value: unknown): VvbWorkpaperReport | null {
  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.reportId !== "string" || !record.reportId.trim()) return null;
  if (typeof record.generatedAt !== "string" || !record.generatedAt.trim()) return null;
  const context = asRecord(record.projectMethodVersionContext);
  if (!context || typeof context.methodologyCode !== "string" || typeof context.methodologyVersion !== "string") return null;
  return value as VvbWorkpaperReport;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const record = asRecord(body) ?? {};
    const report = asVvbWorkpaperReport(record.report);

    if (!report) return new Response("Missing or invalid VVB workpaper report payload", { status: 400 });

    const { zipBytes } = buildVvbWorkpaperExport({ report });
    return new Response(new Uint8Array(zipBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="vvb-draft-workpaper.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`VVB workpaper export failed (500). ${message}`, { status: 500 });
  }
}
