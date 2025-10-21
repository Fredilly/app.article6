import { NextResponse } from "next/server";
import { loadManifestAll } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

export async function GET() {
  try {
    const entries = await loadManifestAll({ showAll: true });
    return NextResponse.json(
      {
        count: entries.length,
        updatedAt: new Date().toISOString(),
        engineUrl: process.env.ENGINE_URL ?? "static",
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: message,
        updatedAt: new Date().toISOString(),
        engineUrl: process.env.ENGINE_URL ?? "static",
      },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
}
