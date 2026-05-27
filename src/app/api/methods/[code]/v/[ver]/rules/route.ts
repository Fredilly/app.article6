import { NextResponse } from "next/server";
import { loadMethodRules } from "@/app/m/_lib/methodRules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  code: string;
  ver: string;
};

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { code, ver } = await context.params;
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();

  const result = await loadMethodRules(code, ver);

  if (id) {
    const rule = result.byId.get(id) ?? null;
    if (!rule) {
      return NextResponse.json(
        { error: `Rule not found: ${id}` },
        { status: 404 },
      );
    }
    return NextResponse.json({ rule, source: result.source });
  }

  return NextResponse.json({ rules: result.rules, source: result.source });
}
