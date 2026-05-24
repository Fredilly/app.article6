import { NextResponse } from "next/server";
import { loadMethodTrace } from "@/app/m/_lib/methodTrace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  code: string;
  ver: string;
};

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { code, ver } = await context.params;
  const result = await loadMethodTrace(code, ver);

  if (!result) {
    return NextResponse.json({ error: "Trace not available" }, { status: 404 });
  }

  return NextResponse.json(result);
}
