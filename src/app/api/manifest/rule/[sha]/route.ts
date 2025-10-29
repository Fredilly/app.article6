import { NextResponse } from "next/server";
import { loadManifestAll } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

export async function GET(_request: Request, context: unknown) {
  const { params } =
    (context as { params?: { sha?: string | null | undefined } } | null | undefined) ?? {};
  const sha = params?.sha?.trim();

  if (!sha) {
    return NextResponse.json(
      { error: "Missing SHA parameter" },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  try {
    const entries = await loadManifestAll({ showAll: true });
    const match = entries.find(entry => entry.sha256 === sha);

    if (!match) {
      return NextResponse.json(
        { error: `Manifest rule not found for SHA ${sha}` },
        { status: 404, headers: RESPONSE_HEADERS },
      );
    }

    return NextResponse.json(match, {
      headers: {
        ...RESPONSE_HEADERS,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="rule-${sha}.json"`,
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
