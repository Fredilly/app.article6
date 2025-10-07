import { readFile } from "node:fs/promises";
import path from "node:path";

export type ManifestEntry = {
  id: string;
  methodology: string;
  version: string;
  rule: string;
  tags: string[];
  pdfId?: string;
  anchor?: string;
  sha256?: string;
  [key: string]: unknown;
};

export type RemoteManifestEntry = Record<string, unknown>;

let cachedEntries: ManifestEntry[] | null = null;

export async function loadManifestEntries(): Promise<ManifestEntry[]> {
  if (cachedEntries) return cachedEntries;
  try {
    const filePath = path.join(process.cwd(), "public", "manifest", "index.json");
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    cachedEntries = Array.isArray(parsed) ? (parsed as ManifestEntry[]) : [];
  } catch {
    cachedEntries = [];
  }
  return cachedEntries;
}

export function manifestKey(methodology?: string, version?: string, ruleId?: string) {
  if (!methodology || !version || !ruleId) return null;
  return `${methodology}::${version}::${ruleId}`;
}

export function clearManifestCache() {
  cachedEntries = null;
}

export function buildManifestIndex(entries: ManifestEntry[]) {
  const index = new Map<string, ManifestEntry>();
  for (const entry of entries) {
    const key = manifestKey(entry.methodology, entry.version, entry.id);
    if (key) index.set(key, entry);
  }
  return index;
}

function parseDocIdentifier(value: unknown) {
  if (typeof value !== "string" || !value) return {} as const;
  const [methodPart, rulePart] = value.split(":");
  if (!methodPart) {
    return { ruleId: rulePart ?? value } as const;
  }
  const [methodology, version] = methodPart.split("@");
  return {
    methodology: methodology ?? undefined,
    version: version ?? undefined,
    ruleId: rulePart ?? undefined,
  } as const;
}

export function extractRemoteKey(entry: RemoteManifestEntry) {
  const docDetails = parseDocIdentifier(entry.doc_id);
  const methodology = typeof entry.methodology_id === "string"
    ? entry.methodology_id
    : typeof entry.methodology === "string"
    ? entry.methodology
    : docDetails.methodology;
  const version = typeof entry.version === "string"
    ? entry.version
    : typeof entry.methodology_version === "string"
    ? entry.methodology_version
    : typeof entry.methodologyVersion === "string"
    ? entry.methodologyVersion
    : docDetails.version;
  const ruleId = typeof entry.rule_id === "string"
    ? entry.rule_id
    : typeof entry.id === "string"
    ? entry.id
    : typeof entry.ruleId === "string"
    ? entry.ruleId
    : docDetails.ruleId;

  return { methodology, version, ruleId };
}

export function coerceManifestEntry(entry: RemoteManifestEntry, manifestIndex: Map<string, ManifestEntry>): ManifestEntry {
  const { methodology, version, ruleId } = extractRemoteKey(entry);
  const key = manifestKey(methodology, version, ruleId);
  if (key) {
    const match = manifestIndex.get(key);
    if (match) return match;
  }

  const ruleText = typeof entry.rule === "string"
    ? entry.rule
    : typeof entry.text === "string"
    ? entry.text
    : typeof entry.section_title === "string"
    ? entry.section_title
    : ruleId ?? "";

  const tags = Array.isArray(entry.tags)
    ? entry.tags.map(tag => String(tag))
    : [];

  const pdfId = typeof entry.pdfId === "string" ? entry.pdfId : undefined;
  const anchor = typeof entry.anchor === "string" ? entry.anchor : undefined;
  const sha256 = typeof entry.sha256 === "string" ? entry.sha256 : undefined;

  return {
    id: ruleId ?? (typeof entry.doc_id === "string" ? entry.doc_id : ""),
    methodology: methodology ?? "",
    version: version ?? "",
    rule: ruleText,
    tags,
    pdfId,
    anchor,
    sha256,
  };
}

export function filterEntries(entries: ManifestEntry[], rawQuery: string, showAll: boolean) {
  if (showAll) return entries;
  const normalizedQuery = rawQuery.toLowerCase();
  return entries.filter(entry => {
    const haystack = JSON.stringify(entry).toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function enrichResults<T extends RemoteManifestEntry>(
  results: T[],
  manifestIndex: Map<string, ManifestEntry>,
) {
  return results.map(result => {
    const entry = coerceManifestEntry(result, manifestIndex);
    return {
      ...result,
      section_title: entry.rule,
      text: entry.rule,
      tags: entry.tags,
      pdfId: entry.pdfId ?? result.pdfId,
      anchor: entry.anchor ?? result.anchor,
      sha256: entry.sha256 ?? result.sha256,
    };
  });
}
