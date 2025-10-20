import { NextResponse } from "next/server";

import { loadManifestAll } from "@/lib/manifestSource";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(_request?: Request) {
  let count = 0;
  try {
    const entries = await loadManifestAll();
    count = Array.isArray(entries) ? entries.length : 0;
  } catch (error) {
    console.warn(
      "[manifest-health] Failed to retrieve manifest entries:",
      error instanceof Error ? error.message : String(error),
    );
  }

  return NextResponse.json({
    count,
    updatedAt: new Date().toISOString(),
    engineUrl: process.env.ENGINE_URL ?? "static",
  });
}
