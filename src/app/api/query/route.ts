export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { runDemoAdapter } from "@/lib/engine/demo";
import type { QueryResponse } from "@/lib/engine/types";

type QueryRequest = { query?: string };
type EngineMode = "remote" | "demo";

const ENGINE_PATH = "/query";

function resolveEngineMode(): EngineMode {
  const adapter = process.env.ENGINE_ADAPTER?.toLowerCase();
  if (adapter === "demo") return "demo";
  if (adapter === "remote") return "remote";
  return process.env.ENGINE_URL ? "remote" : "demo";
}

function resolveEngineEndpoint(): URL {
  const base = process.env.ENGINE_URL;
  if (!base) throw new Error("ENGINE_URL is not configured");
  const sanitizedPath = ENGINE_PATH.startsWith("/") ? ENGINE_PATH : `/${ENGINE_PATH}`;
  const trimmedBase = base.replace(/\/+$/, "");
  if (trimmedBase.endsWith(sanitizedPath)) {
    return new URL(trimmedBase);
  }
  return new URL(`${trimmedBase}${sanitizedPath}`);
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json", Accept: "application/json" };
  const bearer = process.env.ENGINE_BEARER;
  if (bearer) headers["Authorization"] = bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`;
  return headers;
}

async function forwardToEngine(query: string) {
  if (resolveEngineMode() === "demo") {
    const payload = await runDemoAdapter(query);
    return NextResponse.json(payload satisfies QueryResponse);
  }

  const engineUrl = resolveEngineEndpoint();
  const res = await fetch(engineUrl, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ query }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new Error(`Failed to reach engine: ${error instanceof Error ? error.message : String(error)}`);
  });

  const raw = await res.text();
  let parsed: unknown = undefined;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid engine response JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!res.ok) {
    const payload = parsed && typeof parsed === "object" ? parsed : { error: raw || `Engine HTTP ${res.status}` };
    return NextResponse.json(payload, { status: res.status });
  }

  return NextResponse.json(parsed ?? {});
}

export async function POST(req: Request) {
  const { query }: QueryRequest = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
  }

  try {
    return await forwardToEngine(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("text") || url.searchParams.get("query") || "";
  if (!query) {
    return NextResponse.json({ error: "Missing query. Provide ?text=... or ?query=..." }, { status: 400 });
  }

  try {
    return await forwardToEngine(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
