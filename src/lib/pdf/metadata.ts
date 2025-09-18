import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export type PdfMetadataRecord = {
  id: string;
  sha256: string;
  sourcePath: string;
  fileRelative: string;
  absolutePath: string;
};

type Cache = {
  mtimeMs: number;
  records: PdfMetadataRecord[];
};

const META_FILE = path.join(process.cwd(), "data", "methodologies", "META.json");
let cache: Cache | null = null;

function pick(entry: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeRecord(entry: Record<string, unknown>, metaDir: string): PdfMetadataRecord | null {
  const id = pick(entry, ["id", "docId", "slug", "name"]);
  const sha256 = pick(entry, ["sha256", "sha", "hash"]);
  const sourcePath = pick(entry, ["sourcePath", "source_path", "source", "path", "relativePath"]) ?? "";
  const fileRelativeRaw = pick(entry, ["pdf", "file", "filename", "fileRelative", "asset"]);

  if (!id || !sha256 || !fileRelativeRaw) {
    return null;
  }

  const normalizedFile = path.normalize(fileRelativeRaw);
  if (path.isAbsolute(normalizedFile)) {
    throw new Error(`Invalid absolute path for PDF asset: ${fileRelativeRaw}`);
  }

  const absolutePath = path.resolve(metaDir, normalizedFile);
  const relativeCheck = path.relative(metaDir, absolutePath);
  if (relativeCheck.startsWith("..")) {
    throw new Error(`PDF asset escapes methodologies directory: ${fileRelativeRaw}`);
  }

  const relativeNormalized = relativeCheck.split(path.sep).join("/");

  return {
    id,
    sha256,
    sourcePath,
    fileRelative: relativeNormalized,
    absolutePath,
  };
}

async function loadRecords(): Promise<PdfMetadataRecord[]> {
  let metaStat;
  try {
    metaStat = await stat(META_FILE);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      throw new Error("META.json not found. Place it under data/methodologies/META.json");
    }
    throw error;
  }
  if (cache && cache.mtimeMs === metaStat.mtimeMs) {
    return cache.records;
  }

  const raw = await readFile(META_FILE, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse META.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("META.json must be an array of metadata entries");
  }

  const metaDir = path.dirname(META_FILE);
  const records = parsed
    .map((entry) => (entry && typeof entry === "object" ? normalizeRecord(entry as Record<string, unknown>, metaDir) : null))
    .filter((record): record is PdfMetadataRecord => Boolean(record));

  cache = { mtimeMs: metaStat.mtimeMs, records };
  return records;
}

export async function getPdfRecord(identifier: string): Promise<PdfMetadataRecord | null> {
  const id = identifier.trim();
  if (!id) return null;
  const records = await loadRecords();
  const target = id.toLowerCase();
  return (
    records.find((record) => record.id.toLowerCase() === target) ??
    records.find((record) => record.sha256.toLowerCase() === target) ??
    null
  );
}

export async function allPdfRecords(): Promise<PdfMetadataRecord[]> {
  return loadRecords();
}
