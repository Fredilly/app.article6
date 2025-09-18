import { NextRequest, NextResponse } from "next/server";
import { QueryRequestSchema } from "@/lib/query/schema";

function invalidPayload(error: unknown) {
  if (error && typeof error === "object" && "flatten" in (error as Record<string, unknown>)) {
    const issues = (error as { flatten: () => unknown }).flatten();
    return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
  }
  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}

function buildEngineUrl(): URL | null {
  const base = process.env.ENGINE_URL;
  if (!base) {
    return null;
  }
  try {
    return new URL("/query", base);
  } catch (error) {
    console.error("Invalid ENGINE_URL", error);
    return null;
  }
}

async function forwardToEngine(query: string) {
  const endpoint = buildEngineUrl();
  if (!endpoint) {
    return NextResponse.json(
      { error: "ENGINE_URL is not configured" },
      { status: 500 }
    );
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  const engineKey = process.env.ENGINE_KEY;
  if (engineKey) {
    headers["Authorization"] = `Bearer ${engineKey}`;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
      cache: "no-store"
    });
  } catch (error) {
    console.error("Failed to reach engine", error);
    return NextResponse.json({ error: "Engine request failed" }, { status: 502 });
  }

  const raw = await res.text();
  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.error("Engine returned non-JSON response", error);
      return NextResponse.json({ error: "Invalid response from engine" }, { status: 502 });
    }
  }

  return NextResponse.json(data, { status: res.status });
}

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text") ?? req.nextUrl.searchParams.get("query");
  const parse = QueryRequestSchema.safeParse({ query: text ?? "" });
  if (!parse.success) {
    return invalidPayload(parse.error);
  }
  return forwardToEngine(parse.data.query);
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parse = QueryRequestSchema.safeParse(json);
  if (!parse.success) {
    return invalidPayload(parse.error);
  }

  return forwardToEngine(parse.data.query);
}
