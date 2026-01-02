import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { type ManifestEntry } from "@/lib/manifest/cards";

export type MethodRichProbeResult =
  | {
      ok: true;
      sources: string[];
      attempted: string[];
      missing: string[];
      data: {
        rulesRich?: unknown;
        sectionsRich?: unknown;
        rich?: unknown;
      };
    }
  | {
      ok: false;
      sources: [];
      attempted: string[];
      missing: string[];
      data: null;
    };

type Cache = {
  mtimeMs: number;
  entries: ManifestEntry[];
};

const MANIFEST_FILE = path.join(process.cwd(), "public", "manifest", "index.json");
let cache: Cache | null = null;

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse rich JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function tryRead(filePath: string): Promise<unknown | null> {
  try {
    await stat(filePath);
    return await readJsonFile(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return null;
    throw error;
  }
}

async function loadManifestCached(): Promise<ManifestEntry[]> {
  try {
    const manifestStat = await stat(MANIFEST_FILE);
    if (cache && cache.mtimeMs === manifestStat.mtimeMs) return cache.entries;
    const raw = await readFile(MANIFEST_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const entries: ManifestEntry[] = Array.isArray(parsed) ? (parsed as ManifestEntry[]) : [];
    cache = { mtimeMs: manifestStat.mtimeMs, entries };
    return entries;
  } catch {
    return [];
  }
}

function resolveCandidate(manifestPath: string, candidateFileName: string): { absolute: string; relative: string } | null {
  const normalized = path.normalize(manifestPath);
  if (!normalized || path.isAbsolute(normalized)) return null;
  const absolute = path.join(process.cwd(), normalized);
  const dir = path.dirname(absolute);
  const candidateAbs = path.join(dir, candidateFileName);
  const relative = path.relative(process.cwd(), candidateAbs);
  return { absolute: candidateAbs, relative };
}

export async function probeMethodRich(code: string, version: string): Promise<MethodRichProbeResult> {
  const normalizedCode = code.trim();
  const normalizedVersion = version.trim();
  if (!normalizedCode || !normalizedVersion) {
    return { ok: false, sources: [], attempted: [], missing: [], data: null };
  }

  const entries = (await loadManifestCached()).filter(
    (entry) => entry.methodology === normalizedCode && entry.version === normalizedVersion,
  );

  const manifestPath =
    entries
      .map((entry) =>
        typeof (entry as Record<string, unknown>).path === "string"
          ? ((entry as Record<string, unknown>).path as string)
          : null,
      )
      .find((value): value is string => Boolean(value)) ?? undefined;

  if (!manifestPath) {
    return {
      ok: false,
      sources: [],
      attempted: ["(manifest missing path field for this method/version)"],
      missing: ["rich.json", "rules.rich.json", "sections.rich.json"],
      data: null,
    };
  }

  const richCandidate = resolveCandidate(manifestPath, "rich.json");
  const rulesRichCandidate =
    resolveCandidate(manifestPath, "rules.rich.json") ??
    (manifestPath.endsWith("rules.json")
      ? (() => {
          const absolute = path.join(process.cwd(), path.normalize(manifestPath).replace(/rules\.json$/, "rules.rich.json"));
          return { absolute, relative: path.relative(process.cwd(), absolute) };
        })()
      : null);
  const sectionsRichCandidate = resolveCandidate(manifestPath, "sections.rich.json");

  const attempted: string[] = [];
  const missing: string[] = [];
  const sources: string[] = [];
  const data: NonNullable<MethodRichProbeResult["data"]> = {};

  if (richCandidate) {
    attempted.push(richCandidate.relative);
    const parsed = await tryRead(richCandidate.absolute);
    if (parsed) {
      data.rich = parsed;
      sources.push("rich.json");
      return { ok: true, sources, attempted, missing, data };
    }
    missing.push("rich.json");
  }

  if (rulesRichCandidate) {
    attempted.push(rulesRichCandidate.relative);
    const parsed = await tryRead(rulesRichCandidate.absolute);
    if (parsed) {
      data.rulesRich = parsed;
      sources.push("rules.rich.json");
    } else {
      missing.push("rules.rich.json");
    }
  }

  if (sectionsRichCandidate) {
    attempted.push(sectionsRichCandidate.relative);
    const parsed = await tryRead(sectionsRichCandidate.absolute);
    if (parsed) {
      data.sectionsRich = parsed;
      sources.push("sections.rich.json");
    } else {
      missing.push("sections.rich.json");
    }
  }

  if (sources.length) {
    return { ok: true, sources, attempted, missing, data };
  }

  return { ok: false, sources: [], attempted, missing, data: null };
}
