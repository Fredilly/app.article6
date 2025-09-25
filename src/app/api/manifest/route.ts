import { NextResponse } from "next/server";
import { MANIFEST_ENTRIES } from "@/lib/manifest/data";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const results = MANIFEST_ENTRIES.filter(entry => {
    if (!query) return true;
    const haystack = [
      entry.methodology,
      entry.version,
      entry.rule,
      entry.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }).slice(0, 50);

  return NextResponse.json({ results });
}
