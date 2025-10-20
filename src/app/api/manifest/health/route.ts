import { NextResponse } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  let count = 0;
  try {
    const response = await fetch(`${url.origin}/api/manifest?all=1`, { cache: "no-store" });
    if (response.ok) {
      const data: unknown = await response.json().catch(() => []);
      if (Array.isArray(data)) {
        count = data.length;
      }
    }
  } catch (error) {
    console.warn(
      "[manifest-health] Failed to retrieve manifest entries:",
      error instanceof Error ? error.message : String(error),
    );
  }

  return NextResponse.json({
    count,
    updatedAt: new Date().toISOString(),
    engineUrl: process.env.ENGINE_URL ?? "static",
  });
}
