export type NormalizedEntity = {
  type: string;
  value: string;
  confidence?: number;
  sectionId?: string;
};

export type NormalizedTable = {
  title?: string;
  rows: unknown[];
  sectionId?: string;
};

export type NormalizedCitation = {
  label: string;
  sectionId?: string;
  ruleId?: string;
  page?: number;
};

export type NormalizedDiff = {
  label: string;
  from?: string;
  to?: string;
  sectionId?: string;
};

export type NormalizedRichEvidence = {
  entities: NormalizedEntity[];
  tables: NormalizedTable[];
  citations: NormalizedCitation[];
  diffs: NormalizedDiff[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function sectionIdFromText(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/S-\d{1,6}/i);
  return match ? match[0] : undefined;
}

function normalizeCitationsFromRulesRich(rulesRich: unknown): NormalizedCitation[] {
  const items = asArray(rulesRich);
  if (!items) return [];
  const citations: NormalizedCitation[] = [];

  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const ruleId = pickString(record, ["id", "ruleId", "rule_id"]);
    const label = pickString(record, ["summary", "logic", "title", "name"]) ?? ruleId ?? "Rule";

    const refs = asRecord(record.refs);
    const sections =
      (refs ? asArray(refs.sections) : null) ??
      asArray(record.sections) ??
      asArray(record.sectionIds) ??
      null;
    if (!sections) continue;

    for (const section of sections) {
      if (typeof section !== "string") continue;
      const sectionId = sectionIdFromText(section) ?? section.trim();
      if (!sectionId) continue;
      citations.push({
        label,
        sectionId,
        ruleId: ruleId ?? undefined,
      });
    }
  }

  citations.sort((a, b) => {
    const sa = a.sectionId ?? "";
    const sb = b.sectionId ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return (a.ruleId ?? "").localeCompare(b.ruleId ?? "");
  });

  return citations;
}

function normalizeEntities(raw: unknown): NormalizedEntity[] {
  const record = asRecord(raw);
  const candidates: unknown[] = [];

  if (record) {
    for (const key of ["entities", "entity", "ner", "extracted_entities", "extractions"]) {
      const value = record[key];
      if (Array.isArray(value)) candidates.push(...value);
    }
  }

  const entities: NormalizedEntity[] = [];
  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      entities.push({ type: "Unknown", value: item.trim() });
      continue;
    }
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const value = pickString(itemRecord, ["value", "text", "name", "entity"]) ?? "";
    if (!value) continue;
    const type = pickString(itemRecord, ["type", "label", "kind", "category"]) ?? "Unknown";
    const confidence = pickNumber(itemRecord, ["confidence", "score"]);
    const sectionId =
      pickString(itemRecord, ["sectionId", "section_id"]) ?? sectionIdFromText(pickString(itemRecord, ["anchor", "href"]));
    entities.push({ type, value, confidence: confidence ?? undefined, sectionId: sectionId ?? undefined });
  }

  return entities;
}

function normalizeTables(raw: unknown): NormalizedTable[] {
  const record = asRecord(raw);
  const candidates: unknown[] = [];

  if (record) {
    for (const key of ["tables", "table", "extracted_tables"]) {
      const value = record[key];
      if (Array.isArray(value)) candidates.push(...value);
    }
  }

  const tables: NormalizedTable[] = [];
  for (const item of candidates) {
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const rows = Array.isArray(itemRecord.rows)
      ? itemRecord.rows
      : Array.isArray(itemRecord.data)
        ? itemRecord.data
        : Array.isArray(itemRecord.items)
          ? itemRecord.items
          : [];
    if (!rows.length) continue;
    const title = pickString(itemRecord, ["title", "name", "label"]);
    const sectionId =
      pickString(itemRecord, ["sectionId", "section_id"]) ?? sectionIdFromText(pickString(itemRecord, ["anchor", "href"]));
    tables.push({ title: title ?? undefined, rows, sectionId: sectionId ?? undefined });
  }

  return tables;
}

function normalizeCitations(raw: unknown): NormalizedCitation[] {
  const arrayItems = asArray(raw);
  if (arrayItems) {
    const citations: NormalizedCitation[] = [];
    for (const item of arrayItems) {
      const record = asRecord(item);
      if (!record) continue;
      const sectionId =
        pickString(record, ["sectionId", "section_id", "section"]) ??
        sectionIdFromText(pickString(record, ["anchor", "href", "url"]));
      const label =
        pickString(record, ["label", "title", "name"]) ??
        (sectionId ? `Section ${sectionId}` : "Citation");
      const ruleId = pickString(record, ["ruleId", "rule_id", "rule"]);
      const page = pickNumber(record, ["page", "pageNumber"]);
      if (!label && !sectionId) continue;
      citations.push({
        label,
        sectionId: sectionId ?? undefined,
        ruleId: ruleId ?? undefined,
        page: page ?? undefined,
      });
    }
    return citations;
  }

  const record = asRecord(raw);
  const candidates: unknown[] = [];

  if (record) {
    for (const key of ["citations", "citation", "references", "refs", "anchors"]) {
      const value = record[key];
      if (Array.isArray(value)) candidates.push(...value);
    }
  }

  const citations: NormalizedCitation[] = [];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      const sectionId = sectionIdFromText(item);
      citations.push({ label: item.trim(), sectionId: sectionId ?? undefined });
      continue;
    }
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const sectionId =
      pickString(itemRecord, ["sectionId", "section_id", "section"]) ??
      sectionIdFromText(pickString(itemRecord, ["anchor", "href", "url"]));
    const label =
      pickString(itemRecord, ["label", "title", "name"]) ??
      (sectionId ? `Section ${sectionId}` : "Citation");
    const ruleId = pickString(itemRecord, ["ruleId", "rule_id", "rule"]);
    const page = pickNumber(itemRecord, ["page", "pageNumber"]);
    citations.push({ label, sectionId: sectionId ?? undefined, ruleId: ruleId ?? undefined, page: page ?? undefined });
  }

  return citations;
}

function normalizeDiffs(raw: unknown): NormalizedDiff[] {
  const record = asRecord(raw);
  const candidates: unknown[] = [];

  if (record) {
    for (const key of ["diffs", "diff", "changes", "change", "delta"]) {
      const value = record[key];
      if (Array.isArray(value)) candidates.push(...value);
    }
  }

  const diffs: NormalizedDiff[] = [];
  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      diffs.push({ label: item.trim() });
      continue;
    }
    const itemRecord = asRecord(item);
    if (!itemRecord) continue;
    const label = pickString(itemRecord, ["label", "title", "name"]) ?? "Change";
    const from = pickString(itemRecord, ["from", "before", "old"]);
    const to = pickString(itemRecord, ["to", "after", "new"]);
    const sectionId =
      pickString(itemRecord, ["sectionId", "section_id"]) ?? sectionIdFromText(pickString(itemRecord, ["anchor", "href"]));
    diffs.push({ label, from: from ?? undefined, to: to ?? undefined, sectionId: sectionId ?? undefined });
  }

  return diffs;
}

function shallowMergeObjects(values: unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const value of values) {
    const record = asRecord(value);
    if (!record) continue;
    for (const [key, entry] of Object.entries(record)) {
      if (merged[key] === undefined) merged[key] = entry;
    }
  }
  return merged;
}

export function normalizeRichEvidence(raw: unknown): NormalizedRichEvidence {
  if (!raw) return { entities: [], tables: [], citations: [], diffs: [] };

  const record = asRecord(raw);
  const composite = record
    ? shallowMergeObjects([record.rich, raw])
    : asRecord(raw) ?? {};

  const rulesRich = record ? (record.rulesRich ?? null) : null;

  return {
    entities: normalizeEntities(composite),
    tables: normalizeTables(composite),
    citations: [...normalizeCitations(composite), ...normalizeCitationsFromRulesRich(rulesRich)],
    diffs: normalizeDiffs(composite),
  };
}
