import { NextResponse } from "next/server";

import type { ManifestEntry } from "@/lib/manifestSource";
import { loadManifestAll } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

function filterEntries(entries: ManifestEntry[], rawQuery: string, showAll: boolean) {
  if (showAll) return entries;
  const normalizedQuery = rawQuery.toLowerCase();
  return entries.filter((entry) => {
    const haystack = JSON.stringify(entry).toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  const allParam = url.searchParams.get("all") ?? "";
  const showAll = !rawQuery || ["1", "true", "yes"].includes(allParam.toLowerCase());

  const manifestEntries = await loadManifestAll();
  const filtered = filterEntries(manifestEntries, rawQuery, showAll);

  return NextResponse.json(filtered);
}

