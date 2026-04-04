import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { loadManifestEntries } from "@/lib/manifest/cards";

export type MethodVersionLineage = {
  familyKey?: string;
  currentVersion: string;
  previousVersion?: string;
  nextVersion?: string;
  lineage: string[];
  metaPath?: string;
};

type ResolvedMethodVersion = {
  dir: string;
  metaPath?: string;
  manifestPath?: string;
  rootCurrentDir?: string;
};

function pickString(entry: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function versionKey(version: string): [number, number, string] {
  const trimmed = version.trim();
  const match = /^v(\d+)[.-](\d+(?:\.\d+)*)$/i.exec(trimmed);
  if (!match) return [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, trimmed];
  const major = Number(match[1] ?? 0);
  const minorParts = String(match[2] ?? "0")
    .split(".")
    .map((part) => Number(part));
  const minor = minorParts.reduce((acc, part, index) => acc + part / 10 ** (index * 3), 0);
  return [major, minor, trimmed];
}

export function sortVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const [amaj, amin, astr] = versionKey(a);
    const [bmaj, bmin, bstr] = versionKey(b);
    if (amaj !== bmaj) return amaj - bmaj;
    if (amin !== bmin) return amin - bmin;
    return astr.localeCompare(bstr);
  });
}

function resolveRepoRelativeCandidates(manifestPath: string): string[] {
  const normalized = path.normalize(manifestPath);
  if (!normalized || path.isAbsolute(normalized)) return [];
  const direct = path.join(process.cwd(), normalized);
  const publicPrefixed = normalized.startsWith(`public${path.sep}`) ? null : path.join(process.cwd(), "public", normalized);
  return Array.from(new Set([direct, publicPrefixed].filter(Boolean) as string[]));
}

async function tryReadJson(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return null;
    throw error;
  }
}

async function manifestDirectoriesForCode(code: string): Promise<Array<{ dir: string; manifestPath: string }>> {
  const entries = (await loadManifestEntries()).filter(
    (entry) => entry.methodology === code && typeof (entry as Record<string, unknown>).path === "string",
  );
  const directories = new Map<string, string>();

  for (const entry of entries) {
    const manifestPath = ((entry as Record<string, unknown>).path as string).trim();
    for (const candidate of resolveRepoRelativeCandidates(manifestPath)) {
      const dir = path.dirname(candidate);
      try {
        await stat(dir);
        directories.set(dir, candidate);
      } catch {
        continue;
      }
    }
  }

  return Array.from(directories.entries()).map(([dir, manifestPath]) => ({ dir, manifestPath }));
}

export async function resolveMethodVersionFiles(code: string, version: string): Promise<ResolvedMethodVersion | null> {
  const directories = await manifestDirectoriesForCode(code);

  for (const entry of directories) {
    if (path.basename(entry.dir) === version) {
      const metaPath = path.join(entry.dir, "META.json");
      return {
        dir: entry.dir,
        metaPath,
        manifestPath: entry.manifestPath,
        rootCurrentDir: entry.dir,
      };
    }
  }

  for (const entry of directories) {
    const previousDir = path.join(entry.dir, "previous", version);
    try {
      await stat(previousDir);
      return {
        dir: previousDir,
        metaPath: path.join(previousDir, "META.json"),
        rootCurrentDir: entry.dir,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function lineageFromRootCurrentDir(rootCurrentDir: string): Promise<string[]> {
  const versions = new Set<string>([path.basename(rootCurrentDir)]);
  const previousDir = path.join(rootCurrentDir, "previous");
  try {
    const entries = await readdir(previousDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.trim()) versions.add(entry.name.trim());
    }
  } catch {
    // no previous lineage on disk
  }
  return sortVersions(Array.from(versions));
}

export async function loadMethodVersionLineage(
  code: string,
  version: string,
  knownVersions: string[] = [],
): Promise<MethodVersionLineage | null> {
  const resolved = await resolveMethodVersionFiles(code, version);
  const meta =
    resolved?.metaPath ? ((await tryReadJson(resolved.metaPath)) as Record<string, unknown> | null) : null;
  const metaLineage = Array.isArray(meta?.lineage)
    ? meta.lineage.map((item) => String(item)).filter(Boolean)
    : [];
  const rootLineage = resolved?.rootCurrentDir ? await lineageFromRootCurrentDir(resolved.rootCurrentDir) : [];
  const lineage = sortVersions(Array.from(new Set([...knownVersions, ...rootLineage, ...metaLineage])));
  const currentIndex = lineage.indexOf(version);

  return {
    familyKey: pickString(meta ?? {}, ["family_key", "familyKey", "id"]) ?? code,
    currentVersion: pickString(meta ?? {}, ["current_version", "currentVersion", "version"]) ?? version,
    previousVersion:
      pickString(meta ?? {}, ["previous_version", "previousVersion"]) ??
      (currentIndex > 0 ? lineage[currentIndex - 1] : undefined),
    nextVersion:
      pickString(meta ?? {}, ["next_version", "nextVersion"]) ??
      (currentIndex >= 0 && currentIndex < lineage.length - 1 ? lineage[currentIndex + 1] : undefined),
    lineage,
    metaPath: resolved?.metaPath,
  };
}

export async function collectMethodVersionsFromPack(
  code: string,
  manifestPaths: string[],
): Promise<{ versions: string[]; hasPrevious: boolean }> {
  const versions = new Set<string>();

  for (const manifestPath of manifestPaths) {
    for (const candidate of resolveRepoRelativeCandidates(manifestPath)) {
      const dir = path.dirname(candidate);
      versions.add(path.basename(dir));
      const previousDir = path.join(dir, "previous");
      try {
        const entries = await readdir(previousDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.trim()) versions.add(entry.name.trim());
        }
      } catch {
        // no previous directory
      }
    }
  }

  const sorted = sortVersions(Array.from(versions));
  return {
    versions: sorted,
    hasPrevious: sorted.length > 1,
  };
}
