import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadManifestEntries, type ManifestEntry } from "@/lib/manifest/cards";

export type RuleSummary = {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  type?: string;
};

export type RuleFull = RuleSummary & {
  text: string;
  logic?: string;
  summary?: string;
  sha256?: string;
  sectionId?: string;
  anchor?: string;
  citations?: Array<{
    sectionId?: string;
    anchor?: string;
    label?: string;
  }>;
  sourcePath?: string;
};

type RulesResult = {
  rules: RuleSummary[];
  byId: Map<string, RuleFull>;
  source: "rules.rich.json" | "rules.json" | "manifest";
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function snippetFromText(value: string, max = 160): string {
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

function pickStringArray(entry: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = entry[key];
    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  }
  return [];
}

function sectionIdFromAnchor(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/S-\d{1,6}/i);
  return match ? match[0] : undefined;
}

function pickCitations(entry: Record<string, unknown>): RuleFull["citations"] {
  const raw =
    entry.citations ??
    entry.references ??
    entry.refs ??
    entry.anchors ??
    entry.anchor ??
    entry.evidence;

  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const citations: NonNullable<RuleFull["citations"]> = [];

  for (const item of items) {
    if (!item) continue;
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const sectionId = /^S-\d{1,6}$/i.test(trimmed) ? trimmed : sectionIdFromAnchor(trimmed);
      citations.push({
        sectionId,
        anchor: sectionId ? undefined : trimmed,
        label: sectionId ? undefined : trimmed,
      });
      continue;
    }

    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      const sections = Array.isArray(record.sections)
        ? record.sections
        : Array.isArray((record as { refs?: { sections?: unknown[] } }).refs?.sections)
          ? (record as { refs?: { sections?: unknown[] } }).refs?.sections
          : null;
      if (sections?.length) {
        for (const section of sections) {
          if (typeof section !== "string" || !section.trim()) continue;
          citations.push({ sectionId: section.trim(), label: section.trim() });
        }
        continue;
      }
      const anchor = pickString(record, ["anchor", "href", "url"]);
      const sectionId =
        pickString(record, ["sectionId", "section_id", "id"]) ?? sectionIdFromAnchor(anchor);
      const label = pickString(record, ["label", "title", "name"]);
      if (sectionId || anchor || label) {
        citations.push({ sectionId, anchor, label });
      }
    }
  }

  return citations.length ? citations : undefined;
}

function stableDerivedId(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return `derived-${hash}`;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse rules JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function tryLoadRulesFile(manifestPath: string): Promise<{
  source: "rules.rich.json" | "rules.json";
  parsed: unknown;
} | null> {
  const normalized = path.normalize(manifestPath);
  if (path.isAbsolute(normalized)) return null;

  const base = path.join(process.cwd(), normalized);
  const richPath = base.endsWith("rules.json") ? base.replace(/rules\.json$/, "rules.rich.json") : "";
  const candidates = [richPath, base].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      const parsed = await readJsonFile(candidate);
      const source = candidate.endsWith("rules.rich.json") ? "rules.rich.json" : "rules.json";
      return { source, parsed };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === "ENOENT") continue;
    }
  }

  return null;
}

function coerceRulesFromUnknown(parsed: unknown): RuleFull[] {
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).rules)
      ? ((parsed as Record<string, unknown>).rules as unknown[])
      : [];

  const rules: RuleFull[] = [];

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawId = pickString(record, ["id", "rule_id", "ruleId", "key"]);
    const logic = pickString(record, ["logic"]);
    const summary = pickString(record, ["summary"]);
    const title = pickString(record, ["title", "label", "name"]) ?? summary ?? rawId;
    const text =
      pickString(record, ["text", "rule", "logic", "content", "body", "description", "summary"]) ?? "";
    const refs = record.refs && typeof record.refs === "object" ? (record.refs as Record<string, unknown>) : null;
    const refsSections = Array.isArray(refs?.sections)
      ? refs.sections.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)
      : [];
    const id =
      rawId ??
      (title
        ? stableDerivedId(`${title}::${text}`.slice(0, 2000))
        : stableDerivedId(`index::${index}`));
    rules.push({
      id,
      title: title ?? id,
      text,
      snippet: snippetFromText(text || title || id),
      tags: pickStringArray(record, ["tags", "labels"]),
      type: pickString(record, ["type", "kind", "category"]),
      logic: logic ?? undefined,
      summary: summary ?? undefined,
      sha256: pickString(record, ["sha256", "hash"]),
      sectionId: pickString(record, ["sectionId", "section_id"]) ?? refsSections[0],
      anchor: pickString(record, ["anchor", "href"]),
      citations: pickCitations(record),
      sourcePath: pickString(record, ["path", "sourcePath", "source_path"]),
    });
  }

  return rules;
}

function coerceRulesFromManifest(entries: ManifestEntry[]): RuleFull[] {
  return entries
    .map((entry) => {
      const ruleId =
        typeof (entry as Record<string, unknown>).rule_id === "string"
          ? ((entry as Record<string, unknown>).rule_id as string)
          : undefined;
      const id = ruleId ?? entry.id;
      const title = ruleId ?? entry.id;
      const text = entry.rule ?? "";
      return {
        id,
        title,
        text,
        snippet: snippetFromText(text || title),
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        type: undefined,
        sha256: entry.sha256,
        sectionId: typeof entry.sectionId === "string" ? entry.sectionId : undefined,
        anchor:
          typeof (entry as Record<string, unknown>).anchor === "string"
            ? ((entry as Record<string, unknown>).anchor as string)
            : undefined,
        sourcePath: typeof entry.path === "string" ? entry.path : undefined,
      } satisfies RuleFull;
    })
    .filter((rule) => Boolean(rule.id));
}

export async function loadMethodRules(code: string, version: string): Promise<RulesResult> {
  const normalizedCode = code.trim();
  const normalizedVersion = version.trim();
  if (!normalizedCode || !normalizedVersion) {
    return { rules: [], byId: new Map(), source: "manifest" };
  }

  const entries = (await loadManifestEntries()).filter(
    (entry) =>
      entry.methodology === normalizedCode &&
      entry.version === normalizedVersion &&
      Boolean(entry.id),
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
    const loaded = await tryLoadRulesFile(manifestPath);
    if (loaded) {
      const full = coerceRulesFromUnknown(loaded.parsed);
      const byId = new Map(full.map((rule) => [rule.id, rule]));
      const rules = full.map(({ id, title, snippet, tags, type }) => ({ id, title, snippet, tags, type }));
      rules.sort((a, b) => a.id.localeCompare(b.id));
      return { rules, byId, source: loaded.source };
    }
  }

  const full = coerceRulesFromManifest(entries);
  const byId = new Map(full.map((rule) => [rule.id, rule]));
  const rules = full.map(({ id, title, snippet, tags, type }) => ({ id, title, snippet, tags, type }));
  rules.sort((a, b) => a.id.localeCompare(b.id));
  return { rules, byId, source: "manifest" };
}
