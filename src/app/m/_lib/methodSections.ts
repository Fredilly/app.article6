import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadManifestEntries, type ManifestEntry } from "@/lib/manifest/cards";

export type SectionSummary = {
  id: string;
  title: string;
  level: number;
  anchor?: string;
  page?: number;
  textSnippet?: string;
  order?: number;
};

export type SectionFull = SectionSummary & {
  text?: string;
  sourcePath?: string;
};

type SectionsResult = {
  sections: SectionSummary[];
  byId: Map<string, SectionFull>;
  source: "sections.rich.json" | "sections.json" | "manifest";
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function snippetFromText(value: string, max = 240): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
}

function pickString(entry: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(entry: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function extractPageFromAnchor(anchor?: string): number | undefined {
  if (!anchor) return undefined;
  const match = anchor.match(/page=(\d{1,4})/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse sections JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function tryLoadSectionsFile(manifestPath: string): Promise<{
  source: "sections.rich.json" | "sections.json";
  parsed: unknown;
} | null> {
  const normalized = path.normalize(manifestPath);
  if (path.isAbsolute(normalized)) return null;

  const base = path.join(process.cwd(), normalized);
  if (!base.endsWith("rules.json")) return null;

  const richPath = base.replace(/rules\.json$/, "sections.rich.json");
  const plainPath = base.replace(/rules\.json$/, "sections.json");

  for (const candidate of [richPath, plainPath]) {
    try {
      await stat(candidate);
      const parsed = await readJsonFile(candidate);
      const source = candidate.endsWith("sections.rich.json") ? "sections.rich.json" : "sections.json";
      return { source, parsed };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === "ENOENT") continue;
    }
  }

  return null;
}

function coerceSectionsFromUnknown(parsed: unknown): SectionFull[] {
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).sections)
      ? ((parsed as Record<string, unknown>).sections as unknown[])
      : [];

  const sections: SectionFull[] = [];

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = pickString(record, ["id", "sectionId", "section_id"]) ?? `S-${index + 1}`;
    const title = pickString(record, ["title", "heading", "label", "name"]) ?? id;
    const level = pickNumber(record, ["level", "depth"]) ?? 1;
    const anchor = pickString(record, ["anchor", "href"]);
    const page = pickNumber(record, ["page", "pageNumber"]) ?? extractPageFromAnchor(anchor);
    const text = pickString(record, ["text", "content", "body"]);
    const snippet =
      pickString(record, ["snippet", "textSnippet", "excerpt"]) ?? (text ? snippetFromText(text) : undefined);
    const order = pickNumber(record, ["order", "index"]) ?? index;
    const sourcePath = pickString(record, ["path", "sourcePath", "source_path"]);

    sections.push({
      id,
      title,
      level,
      anchor: anchor ?? undefined,
      page: page ?? undefined,
      textSnippet: snippet ?? undefined,
      order,
      text: text ?? undefined,
      sourcePath: sourcePath ?? undefined,
    });
  }

  return sections;
}

function sectionSortKey(id: string): [number, string] {
  const match = /^S-(\d{1,6})$/i.exec(id.trim());
  if (!match) return [Number.POSITIVE_INFINITY, id];
  return [Number(match[1] ?? 0), id];
}

function coerceSectionsFromManifest(entries: ManifestEntry[]): SectionFull[] {
  const map = new Map<string, { id: string; sampleRule?: string; anchor?: string }>();
  for (const entry of entries) {
    const sectionId =
      typeof (entry as Record<string, unknown>).sectionId === "string"
        ? ((entry as Record<string, unknown>).sectionId as string)
        : undefined;
    if (!sectionId) continue;
    const current = map.get(sectionId) ?? { id: sectionId };
    if (!current.sampleRule && entry.rule) current.sampleRule = entry.rule;
    const anchor =
      typeof (entry as Record<string, unknown>).anchor === "string"
        ? ((entry as Record<string, unknown>).anchor as string)
        : undefined;
    if (!current.anchor && anchor) current.anchor = anchor;
    map.set(sectionId, current);
  }

  const sections: SectionFull[] = [];
  for (const value of map.values()) {
    sections.push({
      id: value.id,
      title: value.id,
      level: 1,
      anchor: value.anchor,
      page: extractPageFromAnchor(value.anchor),
      textSnippet: value.sampleRule ? snippetFromText(value.sampleRule) : undefined,
      order: sectionSortKey(value.id)[0],
    });
  }

  sections.sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    const [an, aid] = sectionSortKey(a.id);
    const [bn, bid] = sectionSortKey(b.id);
    if (an !== bn) return an - bn;
    return aid.localeCompare(bid);
  });

  return sections;
}

export async function loadMethodSections(code: string, version: string): Promise<SectionsResult> {
  const normalizedCode = code.trim();
  const normalizedVersion = version.trim();
  if (!normalizedCode || !normalizedVersion) {
    return { sections: [], byId: new Map(), source: "manifest" };
  }

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

  if (manifestPath) {
    const loaded = await tryLoadSectionsFile(manifestPath);
    if (loaded) {
      const full = coerceSectionsFromUnknown(loaded.parsed);
      const byId = new Map(full.map((section) => [section.id, section]));
      const sections = full.map(({ id, title, level, anchor, page, textSnippet, order }) => ({
        id,
        title,
        level,
        anchor,
        page,
        textSnippet,
        order,
      }));
      sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { sections, byId, source: loaded.source };
    }
  }

  const full = coerceSectionsFromManifest(entries);
  const byId = new Map(full.map((section) => [section.id, section]));
  const sections = full.map(({ id, title, level, anchor, page, textSnippet, order }) => ({
    id,
    title,
    level,
    anchor,
    page,
    textSnippet,
    order,
  }));
  return { sections, byId, source: "manifest" };
}
