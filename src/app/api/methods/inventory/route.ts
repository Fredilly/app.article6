import { NextResponse } from "next/server";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";

export async function GET() {
  const { methods, generatedAt, datasetHash } = await getMethodInventory();

  return NextResponse.json({
    generatedAt,
    datasetHash,
    methods: methods.map((method) => ({
      code: method.code,
      versions: method.versions,
      latestVersion: method.latestVersion,
    })),
  });
}

