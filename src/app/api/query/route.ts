export const runtime = "nodejs";
import { NextResponse } from "next/server";

type QueryRequest = { query?: string; text?: string };

const INTERNAL_DEMO_ENGINE = "internal:demo";
const ENGINE_PATH = "/query";

function resolveEngineEndpoint(base?: string): URL {
  const engineBase = base ?? process.env.ENGINE_URL;
  if (!engineBase) throw new Error("ENGINE_URL is not configured");
  const sanitizedPath = ENGINE_PATH.startsWith("/") ? ENGINE_PATH : `/${ENGINE_PATH}`;
  const trimmedBase = engineBase.replace(/\/+$/, "");
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

async function parseJsonResponse(res: Response, context: string, httpLabel: string) {
  const raw = await res.text();
  let parsed: unknown = undefined;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid ${context} response JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!res.ok) {
    const payload = parsed && typeof parsed === "object" ? parsed : { error: raw || `${httpLabel} HTTP ${res.status}` };
    return NextResponse.json(payload, { status: res.status });
  }

  return NextResponse.json(parsed ?? {});
}

async function forwardToInternalDemo(query: string) {
  const internalTarget = new URL(
    "/api/engine-demo",
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );

  const res = await fetch(internalTarget, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new Error(
      `Failed to reach internal demo adapter: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  return parseJsonResponse(res, "internal demo", "Internal demo");
}

async function forwardToEngine(query: string) {
  const engineUrl = process.env.ENGINE_URL;

  if (engineUrl === INTERNAL_DEMO_ENGINE) {
    return forwardToInternalDemo(query);
  }

  const engineEndpoint = resolveEngineEndpoint(engineUrl);
  const res = await fetch(engineEndpoint, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ query }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new Error(`Failed to reach engine: ${error instanceof Error ? error.message : String(error)}`);
  });

  return parseJsonResponse(res, "engine", "Engine");
}

export async function POST(req: Request) {
  const body: QueryRequest = await req.json().catch(() => ({}));
  const query = (body.query ?? body.text ?? "").trim();
  if (!query) {
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
  const query = (url.searchParams.get("text") || url.searchParams.get("query") || "").trim();
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
