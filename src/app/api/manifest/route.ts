import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

async function loadManifest() {
  const fallback: unknown = [];
  try {
    const filePath = path.join(process.cwd(), "public", "manifest", "index.json");
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as unknown;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const data = await loadManifest();
  const entries = Array.isArray(data) ? data : [];

  const results = entries.filter(entry => {
    if (!query) return true;
    if (entry && typeof entry === "object") {
      const haystack = JSON.stringify(entry).toLowerCase();
      return haystack.includes(query);
    }
    return false;
  });

  return NextResponse.json({ results });
}
