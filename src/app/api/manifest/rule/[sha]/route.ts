import { NextResponse } from "next/server";
import { loadManifestWithMeta } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(request: Request, context: any) {
  const shaParam = context.params?.sha?.trim();
  if (!shaParam) {
    return NextResponse.json(
      { error: "Missing SHA parameter" },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const normalizedSha = shaParam.toLowerCase();

  try {
    const result = await loadManifestWithMeta({ showAll: true });
    const match = result.entries.find(
      entry => entry.sha256?.toLowerCase() === normalizedSha,
    );

    if (!match) {
      return NextResponse.json(
        { error: `Rule with sha256 ${shaParam} not found` },
        { status: 404, headers: RESPONSE_HEADERS },
      );
    }

    const body = JSON.stringify(match, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        ...RESPONSE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="rule-${normalizedSha}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
}
