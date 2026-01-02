import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export type MethodInventoryItem = {
  code: string;
  program: string;
  sector: string;
  versions: string[];
  latestVersion?: string;
  versionCount: number;
  hasRich: boolean;
  hasPrevious: boolean;
  generated_at?: string;
  source_sha?: string;
  audit_hashes?: {
    dataset_sha256?: string;
    method_sha256?: string;
    version_sha256?: string;
  };
  versionAuditHashes: Record<string, string | undefined>;
};

type ManifestEntry = Record<string, unknown>;

type MethodAccumulator = {
  code: string;
  program?: string;
  sector?: string;
  versions: Set<string>;
  hashesByVersion: Map<string, string[]>;
  allHashes: string[];
};

type Cache = {
  mtimeMs: number;
  entries: ManifestEntry[];
  datasetHash: string;
  generatedAt: string;
};

const MANIFEST_FILE = path.join(process.cwd(), "public", "manifest", "index.json");
let cache: Cache | null = null;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pickString(entry: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function versionKey(version: string): [number, number, string] {
  const trimmed = version.trim();
  const match = /^v(\d+)[.-](\d+)$/.exec(trimmed);
  if (!match) return [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, trimmed];
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), trimmed];
}

function sortVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const [amaj, amin, astr] = versionKey(a);
    const [bmaj, bmin, bstr] = versionKey(b);
    if (amaj !== bmaj) return amaj - bmaj;
    if (amin !== bmin) return amin - bmin;
    return astr.localeCompare(bstr);
  });
}

async function loadManifest(): Promise<Cache> {
  const manifestStat = await stat(MANIFEST_FILE);
  if (cache && cache.mtimeMs === manifestStat.mtimeMs) return cache;

  const raw = await readFile(MANIFEST_FILE, "utf8");
  const datasetHash = sha256Hex(raw);
  const generatedAt = manifestStat.mtime.toISOString();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse manifest index.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const entries: ManifestEntry[] = Array.isArray(parsed)
    ? (parsed as ManifestEntry[])
    : [];

  cache = { mtimeMs: manifestStat.mtimeMs, entries, datasetHash, generatedAt };
  return cache;
}

function normalizeAuditHash(ruleHashes: string[]): string | undefined {
  const unique = Array.from(new Set(ruleHashes.map((hash) => hash.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
  if (unique.length === 0) return undefined;
  return sha256Hex(unique.join("\n"));
}

export async function getMethodInventory(): Promise<{
  methods: MethodInventoryItem[];
  generatedAt: string;
  datasetHash: string;
}> {
  const { entries, generatedAt, datasetHash } = await loadManifest();

  const map = new Map<string, MethodAccumulator>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const code = pickString(record, ["methodology", "code", "method"]);
    if (!code) continue;

    const version = pickString(record, ["version", "ver"]) ?? "unknown";
    const program = pickString(record, ["provider", "program"]);
    const sector = pickString(record, ["category", "sector"]);
    const sha = pickString(record, ["sha256", "sha", "hash"]);

    let current = map.get(code);
    if (!current) {
      current = {
        code,
        versions: new Set<string>(),
        hashesByVersion: new Map<string, string[]>(),
        allHashes: [],
      };
      map.set(code, current);
    }

    current.versions.add(version);
    if (!current.program && program) current.program = program;
    if (!current.sector && sector) current.sector = sector;

    if (sha) {
      current.allHashes.push(sha);
      const list = current.hashesByVersion.get(version) ?? [];
      list.push(sha);
      current.hashesByVersion.set(version, list);
    }
  }

  const sourceSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    undefined;

  const methods = Array.from(map.values()).map((method) => {
    const versions = sortVersions(Array.from(method.versions));
    const latestVersion = versions.at(-1);

    const versionAuditHashes: Record<string, string | undefined> = {};
    for (const version of versions) {
      versionAuditHashes[version] = normalizeAuditHash(method.hashesByVersion.get(version) ?? []);
    }

    const methodAuditHash = normalizeAuditHash(method.allHashes);

    return {
      code: method.code,
      program: method.program ?? "—",
      sector: method.sector ?? "—",
      versions,
      latestVersion,
      versionCount: versions.length,
      hasRich: false,
      hasPrevious: false,
      generated_at: generatedAt,
      source_sha: sourceSha,
      audit_hashes: {
        dataset_sha256: datasetHash,
        method_sha256: methodAuditHash,
      },
      versionAuditHashes,
    } satisfies MethodInventoryItem;
  });

  methods.sort((a, b) => {
    const program = a.program.localeCompare(b.program);
    if (program !== 0) return program;
    const sector = a.sector.localeCompare(b.sector);
    if (sector !== 0) return sector;
    return a.code.localeCompare(b.code);
  });

  return { methods, generatedAt, datasetHash };
}
