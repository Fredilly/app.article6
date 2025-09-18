import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getPdfRecord } from "@/lib/pdf/metadata";

export const runtime = "nodejs";

type Errno = NodeJS.ErrnoException;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const identifier = params?.id;
  if (!identifier) {
    return NextResponse.json({ error: "Missing PDF identifier" }, { status: 400 });
  }

  try {
    const record = await getPdfRecord(identifier);
    if (!record) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(record.absolutePath);
    } catch (error) {
      const err = error as Errno;
      if (err?.code === "ENOENT") {
        return NextResponse.json({ error: "PDF asset missing" }, { status: 404 });
      }
      throw error;
    }

    const actualSha = createHash("sha256").update(fileBuffer).digest("hex");
    if (actualSha.toLowerCase() !== record.sha256.toLowerCase()) {
      return NextResponse.json({ error: "SHA256 mismatch for PDF asset" }, { status: 500 });
    }

    const safeFilename = record.id.replace(/[^\w.-]+/g, "_");

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "public, max-age=604800, immutable",
      "Content-Disposition": `inline; filename="${safeFilename}.pdf"`,
      "X-Pdf-Id": record.id,
      "X-SHA256": record.sha256,
    });
    headers.set("X-Source-Path", record.sourcePath || record.fileRelative);

    const body = new Uint8Array(fileBuffer.length);
    body.set(fileBuffer);

    return new NextResponse(body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
