import { buildAuditPackZip } from "@/exports/auditPack";
import type { CurrentMethodReviewExportInput } from "@/exports/verificationPackContract";
import { EvidenceSnapshotSchema } from "@/lib/proofMap/evidenceSnapshot";
import type { EvidencePin } from "@/lib/proofMap/types";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asTrimmedOrEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function asCurrentMethodReviewInput(value: unknown): CurrentMethodReviewExportInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CurrentMethodReviewExportInput;
}

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

    let artifact = null;
    try {
      artifact = record.artifact ? EvidenceSnapshotSchema.parse(record.artifact) : null;
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return new Response(`Invalid artifact payload. ${error.message}`, { status: 400 });
      }
      throw error;
    }

    if (artifact) {
      if (asTrimmedOrEmpty(artifact.method.code) !== asTrimmedOrEmpty(method)) {
        return new Response("Artifact method does not match request method", { status: 400 });
      }
      if (asTrimmedOrEmpty(artifact.method.version) !== asTrimmedOrEmpty(version)) {
        return new Response("Artifact version does not match request version", { status: 400 });
      }
      if (artifact.verifier?.finalizedState !== "finalized" || !asTrimmedOrEmpty(artifact.verifier.finalizedAt)) {
        return new Response("Artifact must be explicitly finalized", { status: 400 });
      }
    }

    const evidencePins = Array.isArray(record.evidencePins) ? (record.evidencePins as EvidencePin[]) : [];
    const sourceFiles = Array.isArray(record.sourceFiles) ? record.sourceFiles : [];
    const currentReview = asCurrentMethodReviewInput(record.currentReview);
    const zip = buildAuditPackZip(method, version, {
      finalizedReview: artifact ? { artifact, evidencePins, sourceFiles } : null,
      currentReview: artifact ? null : currentReview,
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
