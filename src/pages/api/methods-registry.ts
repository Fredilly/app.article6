import type { NextApiRequest, NextApiResponse } from "next";

type MethodsRegistryEntry = {
  code: string;
  versions: string[];
};

type MethodsRegistryResponse = {
  source_url: string;
  entries: MethodsRegistryEntry[];
};

const DEFAULT_METHODS_REGISTRY_URL =
  "https://raw.githubusercontent.com/Fredilly/article6-methodologies/main/registry/registry.json";

const FALLBACK_METHODS_REGISTRY_URL =
  "https://raw.githubusercontent.com/Fredilly/article6-methodologies/main/registry.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeVersions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const versions = value
    .map(item => {
      if (typeof item === "string") return item;
      if (isRecord(item) && typeof item.version === "string") return item.version;
      return null;
    })
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map(entry => entry.trim());

  return Array.from(new Set(versions)).sort((a, b) => a.localeCompare(b));
}

function normalizeEntries(payload: unknown): MethodsRegistryEntry[] {
  if (Array.isArray(payload)) {
    const byCode = new Map<string, Set<string>>();
    for (const item of payload) {
      if (!isRecord(item)) continue;
      const standard = typeof item.standard === "string" ? item.standard.trim() : "";
      const program = typeof item.program === "string" ? item.program.trim() : "";
      const rawCode = typeof item.code === "string" ? item.code.trim() : "";
      const code = standard && program && rawCode ? `${standard}/${program}/${rawCode}` : rawCode;
      const version = typeof item.version === "string" ? item.version.trim() : "";
      if (!code || !version) continue;
      const set = byCode.get(code) ?? new Set<string>();
      set.add(version);
      byCode.set(code, set);
    }

    return Array.from(byCode.entries())
      .map(([code, versions]) => ({
        code,
        versions: Array.from(versions).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  if (isRecord(payload) && Array.isArray(payload.methods)) {
    const entries = payload.methods
      .map(method => {
        if (!isRecord(method)) return null;
        const standard = typeof method.standard === "string" ? method.standard.trim() : "";
        const program = typeof method.program === "string" ? method.program.trim() : "";
        const rawCode = typeof method.code === "string" ? method.code.trim() : "";
        const code = standard && program && rawCode ? `${standard}/${program}/${rawCode}` : rawCode;
        if (!code) return null;
        const versions = normalizeVersions(method.versions);
        return { code, versions };
      })
      .filter((entry): entry is MethodsRegistryEntry => entry !== null);

    return entries.sort((a, b) => a.code.localeCompare(b.code));
  }

  return [];
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Registry fetch failed (${response.status})`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadRegistryPayload(sourceUrl: string): Promise<{ sourceUrl: string; payload: unknown }> {
  const payload = await fetchJsonWithTimeout(sourceUrl, 10_000);
  return { sourceUrl, payload };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<MethodsRegistryResponse>,
) {
  const configured = process.env.METHODS_REGISTRY_URL?.trim();
  const preferredUrl = configured || DEFAULT_METHODS_REGISTRY_URL;

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");

  try {
    const loaded = await loadRegistryPayload(preferredUrl).catch(async () => {
      if (configured) throw new Error("Registry fetch failed");
      return loadRegistryPayload(FALLBACK_METHODS_REGISTRY_URL);
    });

    const entries = normalizeEntries(loaded.payload);
    res.status(200).json({ source_url: loaded.sourceUrl, entries });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[methods-registry] failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    res.status(200).json({ source_url: preferredUrl, entries: [] });
  }
}

