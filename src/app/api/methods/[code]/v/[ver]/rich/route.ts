import { NextResponse } from "next/server";
import { probeMethodRich } from "@/app/m/_lib/methodRich";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  code: string;
  ver: string;
};

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { code, ver } = await context.params;
  const result = await probeMethodRich(code, ver);
  return NextResponse.json(result);
}
