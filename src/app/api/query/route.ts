import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

type QueryRequest = { query?: string };
type RetrievalMetric = { key: string; value: number | string };
type EngineResult = { id: string; section: string; refs?: string[]; sha256?: string; score?: number };
type QueryResponse = { engineTag: string; metrics: RetrievalMetric[]; results: EngineResult[] };

const ENGINE_TAG = "mvp-baselines-v1";

async function retrieve(query: string): Promise<QueryResponse> {
  const start = Date.now();

  // 1) If an external engine is provided, call it
  const engineUrl = process.env.ENGINE_URL;
  if (engineUrl) {
    const res = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ENGINE_URL HTTP ${res.status}`);
    const out = (await res.json()) as QueryResponse;
    return {
      engineTag: out.engineTag ?? ENGINE_TAG,
      metrics: [...(out.metrics ?? []), { key: "latency_ms", value: Date.now() - start }],
      results: out.results ?? [],
    };
  }

  // 2) Try module import first if dependency is available
  try {
    const mod: any = await import("article6-methodologies");
    const fn = mod?.retrieve ?? mod?.default ?? mod?.search ?? mod?.query;
    if (typeof fn === "function") {
      const out = await fn({ query });
      return {
        engineTag: ENGINE_TAG,
        metrics: [...(out?.metrics ?? []), { key: "latency_ms", value: Date.now() - start }],
        results: out?.results ?? [],
      } as QueryResponse;
    }
  } catch {
    // ignore import failure and try CLI path
  }

  // 3) Fallback to CLI via package bin
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("article6-methodologies/package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    const binField = pkg?.bin;
    let binRel: string | undefined;
    if (typeof binField === "string") binRel = binField;
    else if (binField && typeof binField === "object") binRel = Object.values<string>(binField)[0];
    if (binRel) {
      const binAbs = path.resolve(path.dirname(pkgPath), binRel);
      const payload = JSON.stringify({ query });
      const result = await new Promise<string>((resolve, reject) => {
        const p = spawn(process.execPath, [binAbs], { stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let err = "";
        p.stdout.on("data", (d) => (out += d.toString()));
        p.stderr.on("data", (d) => (err += d.toString()));
        p.on("error", reject);
        p.on("close", (code) => {
          if (code === 0) resolve(out);
          else reject(new Error(err || `CLI exited ${code}`));
        });
        p.stdin.write(payload);
        p.stdin.end();
      });
      const parsed = JSON.parse(result);
      return {
        engineTag: ENGINE_TAG,
        metrics: [...(parsed?.metrics ?? []), { key: "latency_ms", value: Date.now() - start }],
        results: parsed?.results ?? [],
      } as QueryResponse;
    }
  } catch {
    // ignore and fall back to mock
  }

  // 4) Mock to keep endpoint usable
  const results: EngineResult[] = [
    { id: "mock-1", section: "Placeholder — connect engine for real results.", refs: ["demo:ref-a"], sha256: "deadbeef", score: 0.82 },
    { id: "mock-2", section: "Second placeholder result.", refs: ["demo:ref-b"], sha256: "cafebabe", score: 0.74 },
  ];
  return {
    engineTag: ENGINE_TAG,
    metrics: [
      { key: "latency_ms", value: Date.now() - start },
      { key: "results", value: results.length },
    ],
    results,
  };
}

export async function POST(req: Request) {
  const { query }: QueryRequest = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
  }
  const data = await retrieve(query);
  return NextResponse.json(data satisfies QueryResponse);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("text") || url.searchParams.get("query") || "";
  if (!query) {
    return NextResponse.json({ error: "Missing query. Provide ?text=... or ?query=..." }, { status: 400 });
  }
  const data = await retrieve(query);
  return NextResponse.json(data satisfies QueryResponse);
}

