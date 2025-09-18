import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body?.query ?? body?.text ?? "").trim();
  const engineTag = process.env.NEXT_PUBLIC_ENGINE_TAG || "mvp-baselines-v1";

  // Deterministic demo payload; replace later with real engine output.
  return NextResponse.json({
    engineTag,
    metrics: [{ key: "demo", value: "ok" }],
    results: [
      {
        id: "DEMO-44-12",
        section: "Approved baseline carbon fraction 44/12",
        refs: [
          { type: "pdf", path: "/api/pdf/baseline-carbon-44-12.pdf", page: 1 },
        ],
        score: 1.0,
        echo: query,
      },
    ],
  });
}
