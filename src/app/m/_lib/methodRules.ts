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
  monitoringReport?: MonitoringReportExpectation;
  text?: string;
  sectionId?: string;
  anchor?: string;
  citations?: Array<{
    sectionId?: string;
    anchor?: string;
    label?: string;
  }>;
};

export type MonitoringReportExpectation = {
  narrative_expectation?: string;
  metrics_expectation?: string[];
  appendices_expectation?: string[];
  report_provenance?: {
    methodology_source_ref?: string;
    methodology_section_ids?: string[];
    summary?: string;
  };
  reporting_period?: {
    cadence?: string;
    timing_basis?: string;
  };
};

export type RuleFull = RuleSummary & {
  text: string;
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

function pickNestedStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function pickMonitoringReportExpectation(entry: Record<string, unknown>): MonitoringReportExpectation | undefined {
  const raw = entry.monitoring_report;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const provenanceRaw =
    record.report_provenance && typeof record.report_provenance === "object" && !Array.isArray(record.report_provenance)
      ? (record.report_provenance as Record<string, unknown>)
      : null;
  const reportingPeriodRaw =
    record.reporting_period && typeof record.reporting_period === "object" && !Array.isArray(record.reporting_period)
      ? (record.reporting_period as Record<string, unknown>)
      : null;

  const expectation: MonitoringReportExpectation = {
    narrative_expectation: pickString(record, ["narrative_expectation"]),
    metrics_expectation: pickNestedStringArray(record.metrics_expectation),
    appendices_expectation: pickNestedStringArray(record.appendices_expectation),
    report_provenance: provenanceRaw
      ? {
          methodology_source_ref: pickString(provenanceRaw, ["methodology_source_ref"]),
          methodology_section_ids: pickNestedStringArray(provenanceRaw.methodology_section_ids),
          summary: pickString(provenanceRaw, ["summary"]),
        }
      : undefined,
    reporting_period: reportingPeriodRaw
      ? {
          cadence: pickString(reportingPeriodRaw, ["cadence"]),
          timing_basis: pickString(reportingPeriodRaw, ["timing_basis"]),
        }
      : undefined,
  };

  return Object.values(expectation).some((value) =>
    Array.isArray(value) ? value.length > 0 : value && typeof value === "object" ? Object.values(value).some(Boolean) : Boolean(value),
  )
    ? expectation
    : undefined;
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

function resolveRepoRelativeCandidates(manifestPath: string): string[] {
  const normalized = path.normalize(manifestPath);
  if (!normalized || path.isAbsolute(normalized)) return [];
  const direct = path.join(process.cwd(), normalized);
  const publicPrefixed = normalized.startsWith(`public${path.sep}`) ? null : path.join(process.cwd(), "public", normalized);
  return Array.from(new Set([direct, publicPrefixed].filter(Boolean) as string[]));
}

async function tryLoadRulesFile(manifestPath: string): Promise<{
  source: "rules.rich.json" | "rules.json";
  parsed: unknown;
} | null> {
  const bases = resolveRepoRelativeCandidates(manifestPath).filter((candidate) => candidate.endsWith("rules.json"));
  if (!bases.length) return null;

  const candidates = bases.flatMap((base) => [base.replace(/rules\.json$/, "rules.rich.json"), base]);

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
      monitoringReport: pickMonitoringReportExpectation(record),
      sha256: pickString(record, ["sha256", "hash"]),
      sectionId: pickString(record, ["sectionId", "section_id"]),
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
      const rules = full.map(({ id, title, snippet, tags, type, monitoringReport, text, sectionId, anchor, citations }) => ({
        id,
        title,
        snippet,
        tags,
        type,
        monitoringReport,
        text,
        sectionId,
        anchor,
        citations,
      }));
      rules.sort((a, b) => a.id.localeCompare(b.id));
      return { rules, byId, source: loaded.source };
    }
  }

  const full = coerceRulesFromManifest(entries);
  const byId = new Map(full.map((rule) => [rule.id, rule]));
  const rules = full.map(({ id, title, snippet, tags, type, monitoringReport, text, sectionId, anchor, citations }) => ({
    id,
    title,
    snippet,
    tags,
    type,
    monitoringReport,
    text,
    sectionId,
    anchor,
    citations,
  }));
  rules.sort((a, b) => a.id.localeCompare(b.id));
  return { rules, byId, source: "manifest" };
}
