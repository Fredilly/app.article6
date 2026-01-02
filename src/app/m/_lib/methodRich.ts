import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadManifestEntries, type ManifestEntry } from "@/lib/manifest/cards";

export type MethodRichResult = {
  raw: {
    rulesRich?: unknown;
    sectionsRich?: unknown;
    rich?: unknown;
  };
  sources: {
    rulesRich?: string;
    sectionsRich?: string;
    rich?: string;
  };
};

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

function resolveCandidate(manifestPath: string, candidateFileName: string): string | null {
  const normalized = path.normalize(manifestPath);
  if (!normalized || path.isAbsolute(normalized)) return null;
  const absolute = path.join(process.cwd(), normalized);
  const dir = absolute.endsWith("rules.json") ? path.dirname(absolute) : path.dirname(absolute);
  return path.join(dir, candidateFileName);
}

export async function loadMethodRich(code: string, version: string): Promise<MethodRichResult> {
  const normalizedCode = code.trim();
  const normalizedVersion = version.trim();
  if (!normalizedCode || !normalizedVersion) return { raw: {}, sources: {} };

  const entries = (await loadManifestEntries()).filter(
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

  if (!manifestPath) return { raw: {}, sources: {} };

  const rulesRichPath =
    resolveCandidate(manifestPath, "rules.rich.json") ??
    (manifestPath.endsWith("rules.json")
      ? path.join(process.cwd(), path.normalize(manifestPath).replace(/rules\.json$/, "rules.rich.json"))
      : null);
  const sectionsRichPath = resolveCandidate(manifestPath, "sections.rich.json");
  const richPath = resolveCandidate(manifestPath, "rich.json");

  const raw: MethodRichResult["raw"] = {};
  const sources: MethodRichResult["sources"] = {};

  if (rulesRichPath) {
    const parsed = await tryRead(rulesRichPath);
    if (parsed) {
      raw.rulesRich = parsed;
      sources.rulesRich = rulesRichPath;
    }
  }

  if (sectionsRichPath) {
    const parsed = await tryRead(sectionsRichPath);
    if (parsed) {
      raw.sectionsRich = parsed;
      sources.sectionsRich = sectionsRichPath;
    }
  }

  if (richPath) {
    const parsed = await tryRead(richPath);
    if (parsed) {
      raw.rich = parsed;
      sources.rich = richPath;
    }
  }

  // If rich artifacts are missing, include minimal metadata for debugging (non-fatal).
  if (!raw.rulesRich && !raw.sectionsRich && !raw.rich) {
    raw.rich = {
      message: "No rich artifacts found for this method/version.",
      methodology: normalizedCode,
      version: normalizedVersion,
      sampleEntry: entries[0] ? (entries[0] satisfies ManifestEntry) : null,
    };
  }

  return { raw, sources };
}

