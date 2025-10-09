import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EngineResult } from "@/lib/engine/types";

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

export async function loadManifestEntries(): Promise<ManifestEntry[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "manifest", "index.json");
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? (parsed as ManifestEntry[]) : [];
  } catch {
    return [];
  }
}

export function manifestKey(methodology?: string, version?: string, ruleId?: string) {
  if (!methodology || !version || !ruleId) return null;
  return `${methodology}::${version}::${ruleId}`;
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
  const methodology =
    typeof entry.methodology_id === "string"
      ? entry.methodology_id
      : typeof entry.methodology === "string"
      ? entry.methodology
      : docDetails.methodology;

  const version =
    typeof entry.version === "string"
      ? entry.version
      : typeof entry.methodology_version === "string"
      ? entry.methodology_version
      : typeof entry.methodologyVersion === "string"
      ? entry.methodologyVersion
      : docDetails.version;

  const ruleId =
    typeof entry.rule_id === "string"
      ? entry.rule_id
      : typeof entry.id === "string"
      ? entry.id
      : typeof entry.ruleId === "string"
      ? entry.ruleId
      : docDetails.ruleId;

  return { methodology, version, ruleId };
}

export function coerceManifestEntry(
  entry: RemoteManifestEntry,
  manifestIndex: Map<string, ManifestEntry>,
): ManifestEntry {
  const { methodology, version, ruleId } = extractRemoteKey(entry);
  const key = manifestKey(methodology, version, ruleId);
  if (key) {
    const match = manifestIndex.get(key);
    if (match) return match;
  }

  const ruleText =
    typeof entry.rule === "string"
      ? entry.rule
      : typeof entry.text === "string"
      ? entry.text
      : typeof entry.section_title === "string"
      ? entry.section_title
      : ruleId ?? "";

  const tags = Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)) : [];

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
  return entries.filter((entry) => {
    const haystack = JSON.stringify(entry).toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function enrichResults(
  results: RemoteManifestEntry[],
  manifestIndex: Map<string, ManifestEntry>,
): EngineResult[] {
  return results.map((result) => {
    const entry = coerceManifestEntry(result, manifestIndex);
    const refs = Array.isArray(result.refs) ? result.refs.map(String) : undefined;

    const pdfId =
      typeof entry.pdfId === "string"
        ? entry.pdfId
        : typeof result.pdfId === "string"
        ? result.pdfId
        : undefined;

    const anchor =
      typeof entry.anchor === "string"
        ? entry.anchor
        : typeof result.anchor === "string"
        ? result.anchor
        : undefined;

    const sha256 =
      typeof entry.sha256 === "string"
        ? entry.sha256
        : typeof result.sha256 === "string"
        ? result.sha256
        : undefined;

    const methodologyId =
      entry.methodology ||
      (typeof result.methodology_id === "string" ? result.methodology_id : undefined);

    const methodologyVersion =
      entry.version ||
      (typeof result.methodology_version === "string" ? result.methodology_version : undefined);

    return {
      id: entry.id,
      section: typeof result.section === "string" ? result.section : undefined,
      section_title: entry.rule,
      sectionTitle: entry.rule,
      text: entry.rule,
      refs,
      sha256,
      score: typeof result.score === "number" ? result.score : undefined,
      methodology_id: methodologyId,
      methodologyId: methodologyId,
      methodology_version: methodologyVersion,
      methodologyVersion: methodologyVersion,
      tags: entry.tags,
    } satisfies EngineResult;
  });
}
