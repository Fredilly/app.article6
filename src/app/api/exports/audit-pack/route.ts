import { buildAuditPackZip } from "@/exports/auditPack";

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
