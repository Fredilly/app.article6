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
  sha256?: string;
  sectionId?: string;
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
    const title = pickString(record, ["title", "label", "name"]) ?? rawId;
    const text =
      pickString(record, ["text", "rule", "content", "body", "description", "summary"]) ?? "";
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
      sha256: pickString(record, ["sha256", "hash"]),
      sectionId: pickString(record, ["sectionId", "section_id"]),
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
