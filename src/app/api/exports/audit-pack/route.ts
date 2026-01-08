import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildAuditPack } from "@/exports/buildAuditPack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getArtifactRoots(repoRoot: string): string[] {
  const env = process.env.ARTIFACT_ROOTS;
  const roots = (env ? env.split(",").map((s) => s.trim()) : ["methodologies", "public", "data", "artifacts", "src/data"])
    .filter(Boolean)
    .map((p) => path.join(repoRoot, p));
  return roots.filter((p) => fs.existsSync(p));
}

export async function GET() {
  const repoRoot = process.cwd();
  const prebuiltPath = path.join(repoRoot, "public", "exports", "audit-pack.zip");

  if (fs.existsSync(prebuiltPath)) {
    const bytes = fs.readFileSync(prebuiltPath);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="audit-pack.zip"',
        "Cache-Control": "no-store",
      },
    });
  }

  const artifactRoots = getArtifactRoots(repoRoot);
  if (artifactRoots.length === 0) {
    return new Response("No artifact roots found. Set ARTIFACT_ROOTS=dir1,dir2.", { status: 500 });
  }

  const { zipBytes } = await buildAuditPack({ repoRoot, artifactRoots });
  return new Response(new Uint8Array(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="audit-pack.zip"',
      "Cache-Control": "no-store",
    },
  });
}
