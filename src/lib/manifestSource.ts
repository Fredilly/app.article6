import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from '@/lib/engine/config';

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

async function loadStaticManifest(): Promise<ManifestEntry[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'manifest', 'index.json');
    const contents = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? (parsed as ManifestEntry[]) : [];
  } catch {
    return [];
  }
}

function manifestKey(methodology?: string, version?: string, ruleId?: string) {
  if (!methodology || !version || !ruleId) return null;
  return `${methodology}::${version}::${ruleId}`;
}

function buildManifestIndex(entries: ManifestEntry[]) {
  const index = new Map<string, ManifestEntry>();
  for (const entry of entries) {
    const key = manifestKey(entry.methodology, entry.version, entry.id);
    if (key) index.set(key, entry);
  }
  return index;
}

function parseDocIdentifier(value: unknown) {
  if (typeof value !== 'string' || !value) return {};
  const [methodPart, rulePart] = value.split(':');
  if (!methodPart) {
    return { ruleId: rulePart ?? value };
  }
  const [methodology, version] = methodPart.split('@');
  return {
    methodology: methodology ?? undefined,
    version: version ?? undefined,
    ruleId: rulePart ?? undefined,
  };
}

function extractRemoteKey(entry: RemoteManifestEntry) {
  const docDetails = parseDocIdentifier(entry.doc_id);
  const methodology =
    typeof entry.methodology_id === 'string'
      ? entry.methodology_id
      : typeof entry.methodology === 'string'
      ? entry.methodology
      : docDetails.methodology;

  const version =
    typeof entry.version === 'string'
      ? entry.version
      : typeof entry.methodology_version === 'string'
      ? entry.methodology_version
      : typeof entry.methodologyVersion === 'string'
      ? entry.methodologyVersion
      : docDetails.version;

  const ruleId =
    typeof entry.rule_id === 'string'
      ? entry.rule_id
      : typeof entry.id === 'string'
      ? entry.id
      : typeof entry.ruleId === 'string'
      ? entry.ruleId
      : docDetails.ruleId;

  return { methodology, version, ruleId };
}

function coerceManifestEntry(entry: RemoteManifestEntry, manifestIndex: Map<string, ManifestEntry>): ManifestEntry {
  const { methodology, version, ruleId } = extractRemoteKey(entry);
  const key = manifestKey(methodology, version, ruleId);
  if (key) {
    const match = manifestIndex.get(key);
    if (match) return match;
  }

  const ruleText =
    typeof entry.rule === 'string'
      ? entry.rule
      : typeof entry.text === 'string'
      ? entry.text
      : typeof entry.section_title === 'string'
      ? entry.section_title
      : (ruleId as string) ?? '';

  const tags = Array.isArray(entry.tags) ? entry.tags.map((t) => String(t)) : [];

  const pdfId = typeof entry.pdfId === 'string' ? entry.pdfId : undefined;
  const anchor = typeof entry.anchor === 'string' ? entry.anchor : undefined;
  const sha256 = typeof entry.sha256 === 'string' ? entry.sha256 : undefined;

  return {
    id: (ruleId as string) ?? (typeof entry.doc_id === 'string' ? entry.doc_id : ''),
    methodology: methodology ?? '',
    version: version ?? '',
    rule: ruleText,
    tags,
    pdfId,
    anchor,
    sha256,
  };
}

function extractRemoteEntries(parsedBody: unknown) {
  if (Array.isArray(parsedBody)) return parsedBody;
  if (parsedBody && typeof parsedBody === 'object') {
    const candidate = (parsedBody as { results?: unknown[]; rules?: unknown[] }).results ??
      (parsedBody as { results?: unknown[]; rules?: unknown[] }).rules;
    return candidate;
  }
  return undefined;
}

export async function loadManifestAll(): Promise<ManifestEntry[]> {
  const manifestEntries = await loadStaticManifest();

  if (resolveEngineMode() !== 'remote') {
    return manifestEntries;
  }

  try {
    const engineUrl = resolveEngineEndpoint();
    const manifestUrl = new URL(engineUrl);
    const normalizedPath = manifestUrl.pathname.replace(/\/$/, '');
    manifestUrl.pathname = normalizedPath.endsWith('/query')
      ? `${normalizedPath.slice(0, -6)}/manifest`
      : `${normalizedPath}/manifest`;
    manifestUrl.searchParams.set('all', '1');
    manifestUrl.searchParams.set('view', 'cards');

    const response = await fetch(manifestUrl, {
      method: 'GET',
      headers: buildEngineHeaders(),
      cache: 'no-store',
    }).catch((error) => {
      throw new Error(
        `Failed to reach engine manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    const rawBody = await response.text();
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (error) {
        throw new Error(
          `Invalid engine manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!response.ok) {
      throw new Error(`Engine manifest responded ${response.status}: ${rawBody || 'no body'}`);
    }

    const remoteEntries = extractRemoteEntries(parsedBody);

    if (!Array.isArray(remoteEntries)) {
      throw new Error('Engine manifest response missing rules array');
    }

    const manifestIndex = buildManifestIndex(manifestEntries);
    const enriched = remoteEntries.map((entry) =>
      coerceManifestEntry(entry as RemoteManifestEntry, manifestIndex),
    );

    return enriched;
  } catch (error) {
    console.warn(
      '[manifestSource] Remote manifest unavailable, using static dataset:',
      error instanceof Error ? error.message : String(error),
    );
    return manifestEntries;
  }
}
