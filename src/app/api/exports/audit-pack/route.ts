import { buildAuditPackZip } from "@/exports/auditPack";
import { EvidenceSnapshotSchema } from "@/lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "@/lib/proofMap/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const method = url.searchParams.get("method") || "";
  const version = url.searchParams.get("version") || "";
  if (!method || !version) return new Response("Missing ?method=AR-XXXX&version=vYY-Y", { status: 400 });

  try {
    const zip = buildAuditPackZip(method, version);
    return new Response(zip, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="audit-pack.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Audit pack export failed (500). ${message}`, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    const method = typeof record.method === "string" ? record.method : "";
    const version = typeof record.version === "string" ? record.version : "";
    if (!method || !version) return new Response("Missing method/version in request body", { status: 400 });

    const artifact = record.artifact ? EvidenceSnapshotSchema.parse(record.artifact) : null;
    const evidencePins = Array.isArray(record.evidencePins) ? (record.evidencePins as EvidencePin[]) : [];
    const zip = buildAuditPackZip(method, version, {
      finalizedReview: artifact ? { artifact, evidencePins } : null,
    });
    return new Response(zip, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="audit-pack.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Audit pack export failed (500). ${message}`, { status: 500 });
  }
}
