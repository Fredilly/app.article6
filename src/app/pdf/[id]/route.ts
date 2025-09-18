import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

type EvidenceIndex = Record<
  string,
  {
    id: string;
    title?: string;
    sha256: string;
    sourcePath: string;
    file: string;
  }
>;

async function loadIndex(): Promise<EvidenceIndex> {
  const indexPath = path.join(process.cwd(), "public", "pdfs", "index.json");
  const content = await fs.readFile(indexPath, "utf-8");
  return JSON.parse(content) as EvidenceIndex;
}

async function resolveEntry(id: string) {
  const index = await loadIndex();
  const entry = index[id];
  if (!entry) {
    return null;
  }
  const filePath = path.join(process.cwd(), "public", entry.file.replace(/^\//, ""));
  const stats = await fs.stat(filePath);
  return { entry, filePath, size: stats.size };
}

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const result = await resolveEntry(context.params.id);
    if (!result) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    const { entry, filePath, size } = result;
    const wantsDownload = req.nextUrl.searchParams.has("download");

    if (wantsDownload) {
      const fileBuffer = await fs.readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": size.toString(),
          "Content-Disposition": `inline; filename="${entry.id}.pdf"`,
          "X-Source-Path": entry.sourcePath,
          "X-Sha256": entry.sha256
        }
      });
    }

    return NextResponse.json({
      id: entry.id,
      title: entry.title,
      sha256: entry.sha256,
      sourcePath: entry.sourcePath,
      downloadUrl: `/pdf/${encodeURIComponent(entry.id)}?download=1`,
      size
    });
  } catch (error) {
    console.error("Failed to serve PDF", error);
    return NextResponse.json({ error: "Failed to load evidence asset" }, { status: 500 });
  }
}
