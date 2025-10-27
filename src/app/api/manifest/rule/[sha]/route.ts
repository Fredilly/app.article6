import { NextResponse } from "next/server";

import { loadManifestAll } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, context: { params: { sha: string } }) {
  const sha = context.params.sha;
  if (!sha || typeof sha !== "string") {
    return NextResponse.json({ error: "Missing SHA" }, { status: 400 });
  }

  const normalized = sha.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "Invalid SHA" }, { status: 400 });
  }

  try {
    const entries = await loadManifestAll({ showAll: true });
    const match = entries.find(entry => (entry.sha256 ?? "").toLowerCase() === normalized);
    if (!match) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(match, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rule-${normalized}.json"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
