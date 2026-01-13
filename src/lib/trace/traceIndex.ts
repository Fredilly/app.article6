export type TraceSectionLink = {
  section_id: string;
  title?: string | null;
  anchor?: string | null;
  match: "explicit" | "text";
};

export type TraceIndex = {
  version: 1;
  method: { code: string; version: string };
  rule_to_sections: Record<string, TraceSectionLink[]>;
  rule_to_evidence: Record<string, unknown>;
};

type RuleEntry = {
  id: string;
  text: string;
  sectionRefs: string[];
};

type SectionEntry = {
  section_id: string;
  title?: string | null;
  anchor?: string | null;
  _blob: string;
  _rule_refs: unknown;
};

function stableStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function stripText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stripText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(stripText).join(" ");
  return "";
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseSectionIdsFromValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseSectionIdsFromValue);
  if (typeof value === "string") {
    const matches = value.match(/S-\d{1,6}/gi) ?? [];
    return matches.map((match) => match.toUpperCase());
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return parseSectionIdsFromValue(record.sectionId ?? record.section_id ?? record.id ?? record.anchor ?? record.href);
  }
  return [];
}

function collectRules(rulesJson: unknown): RuleEntry[] {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === "object" && Array.isArray((rulesJson as Record<string, unknown>).rules)
      ? ((rulesJson as Record<string, unknown>).rules as unknown[])
      : rulesJson && typeof rulesJson === "object"
        ? Object.values(rulesJson as Record<string, unknown>)
        : [];

  const rules: RuleEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = pickString(record, ["id", "rule_id", "ruleId", "key"]);
    if (!id) continue;
    const text =
      pickString(record, ["text", "rule", "content", "body", "description", "summary"]) ?? "";

    const sectionRefs = new Set<string>();
    for (const key of [
      "sectionId",
      "section_id",
      "sectionIds",
      "section_ids",
      "sections",
      "section_refs",
      "sectionRefs",
    ]) {
      for (const value of parseSectionIdsFromValue(record[key])) sectionRefs.add(value);
    }

    const citations = record.citations ?? record.references ?? record.anchors ?? record.anchor ?? record.evidence;
    for (const value of parseSectionIdsFromValue(citations)) sectionRefs.add(value);

    rules.push({
      id: id.trim(),
      text,
      sectionRefs: Array.from(sectionRefs),
    });
  }

  return rules.sort((a, b) => a.id.localeCompare(b.id));
}

function collectSections(sectionsJson: unknown): SectionEntry[] {
  const items = Array.isArray(sectionsJson)
    ? sectionsJson
    : sectionsJson && typeof sectionsJson === "object" && Array.isArray((sectionsJson as Record<string, unknown>).sections)
      ? ((sectionsJson as Record<string, unknown>).sections as unknown[])
      : sectionsJson && typeof sectionsJson === "object"
        ? Object.values(sectionsJson as Record<string, unknown>)
        : [];

  const sections: SectionEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const sectionId = pickString(record, ["id", "sectionId", "section_id", "key"]);
    if (!sectionId) continue;
    sections.push({
      section_id: sectionId.trim(),
      title: pickString(record, ["title", "heading", "label", "name"]) ?? null,
      anchor: pickString(record, ["anchor", "href"]) ?? null,
      _blob: stripText(record.content ?? record.body ?? record.text ?? record),
      _rule_refs: record.rule_refs ?? record.rules ?? record.rule_ids ?? null,
    });
  }

  return sections;
}

function sectionRefsFromValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => sectionRefsFromValue(item));
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

export function buildTraceIndex(input: {
  method: { code: string; version: string };
  rules: unknown;
  sections: unknown;
}): TraceIndex {
  const rules = collectRules(input.rules);
  const sections = collectSections(input.sections);
  const sectionsById = new Map(sections.map((section) => [section.section_id, section]));

  const rule_to_sections: Record<string, TraceSectionLink[]> = {};

  for (const rule of rules) {
    const hits = new Map<string, TraceSectionLink>();

    for (const ref of rule.sectionRefs) {
      const section = sectionsById.get(ref);
      hits.set(ref, {
        section_id: ref,
        title: section?.title ?? null,
        anchor: section?.anchor ?? null,
        match: "explicit",
      });
    }

    for (const section of sections) {
      const refs = sectionRefsFromValue(section._rule_refs);
      if (refs.map((value) => value.toString()).includes(rule.id)) {
        hits.set(section.section_id, {
          section_id: section.section_id,
          title: section.title ?? null,
          anchor: section.anchor ?? null,
          match: "explicit",
        });
      }
    }

    if (hits.size === 0) {
      for (const section of sections) {
        if (!section._blob.includes(rule.id)) continue;
        hits.set(section.section_id, {
          section_id: section.section_id,
          title: section.title ?? null,
          anchor: section.anchor ?? null,
          match: "text",
        });
      }
    }

    if (hits.size) {
      const sorted = Array.from(hits.values()).sort((a, b) => stableStr(a.section_id).localeCompare(stableStr(b.section_id)));
      rule_to_sections[rule.id] = sorted;
    }
  }

  return {
    version: 1,
    method: input.method,
    rule_to_sections,
    rule_to_evidence: {},
  };
}
