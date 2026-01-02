import { NextResponse } from "next/server";
import { loadMethodSections } from "@/app/m/_lib/methodSections";

type Params = {
  code: string;
  ver: string;
};

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const { code, ver } = await context.params;
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();

  const result = await loadMethodSections(code, ver);

  if (id) {
    const section = result.byId.get(id) ?? null;
    if (!section) {
      return NextResponse.json({ error: `Section not found: ${id}` }, { status: 404 });
    }
    return NextResponse.json({ section, source: result.source });
  }

  return NextResponse.json({ sections: result.sections, source: result.source });
}

