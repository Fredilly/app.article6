import { NextResponse } from "next/server";
import { loadManifestAll } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  const allParam = url.searchParams.get("all") ?? "";
  const showAll = !rawQuery || ["1", "true", "yes"].includes(allParam.toLowerCase());

  try {
    const results = await loadManifestAll({ rawQuery, showAll });
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
