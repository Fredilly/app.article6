/**
 * Deterministic trace index:
 * - rule_id -> linked sections (by explicit refs if present, else conservative text match)
 */
import fs from "node:fs";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function stableStr(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function stripText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stripText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(stripText).join(" ");
  return "";
}

function pickString(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseSectionIdsFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseSectionIdsFromValue);
  if (typeof value === "string") {
    const matches = value.match(/S-\d{1,6}/gi) ?? [];
    return matches.map((match) => match.toUpperCase());
  }
  if (typeof value === "object") {
    return parseSectionIdsFromValue(value.sectionId ?? value.section_id ?? value.id ?? value.anchor ?? value.href);
  }
  return [];
}

function collectRules(rulesJson) {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === "object" && Array.isArray(rulesJson.rules)
      ? rulesJson.rules
      : rulesJson && typeof rulesJson === "object"
        ? Object.values(rulesJson)
        : [];

  const rules = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item;
    const id = pickString(record, ["id", "rule_id", "ruleId", "key"]);
    if (!id) continue;
    const text =
      pickString(record, ["text", "rule", "content", "body", "description", "summary"]) ?? "";

    const sectionRefs = new Set();
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

    rules.push({ id: id.trim(), text, sectionRefs: Array.from(sectionRefs) });
  }

  return rules.sort((a, b) => a.id.localeCompare(b.id));
}

function collectSections(sectionsJson) {
  const items = Array.isArray(sectionsJson)
    ? sectionsJson
    : sectionsJson && typeof sectionsJson === "object" && Array.isArray(sectionsJson.sections)
      ? sectionsJson.sections
      : sectionsJson && typeof sectionsJson === "object"
        ? Object.values(sectionsJson)
        : [];

  const sections = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item;
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

function sectionRefsFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(sectionRefsFromValue);
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

export function genTrace({ method, rulesPath, sectionsPath, outPath }) {
  const rulesJson = readJson(rulesPath);
  const sectionsJson = readJson(sectionsPath);

  const rules = collectRules(rulesJson);
  const sections = collectSections(sectionsJson);
  const sectionsById = new Map(sections.map((section) => [section.section_id, section]));

  const rule_to_sections = {};

  for (const rule of rules) {
    const hits = new Map();

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

  const trace = {
    version: 1,
    method,
    rule_to_sections,
    rule_to_evidence: {},
  };

  writeJson(outPath, trace);
}

if (process.argv[1]?.includes("gen-trace-index.mjs")) {
  const rulesPath = process.argv[2];
  const sectionsPath = process.argv[3];
  const outPath = process.argv[4] ?? "trace.json";
  const methodCode = process.argv[5] ?? "";
  const methodVersion = process.argv[6] ?? "";

  if (!rulesPath || !sectionsPath || !methodCode || !methodVersion) {
    console.error(
      "Usage: node gen-trace-index.mjs <rules.json> <sections.json> <out trace.json> <methodCode> <methodVersion>",
    );
    process.exit(2);
  }

  genTrace({
    method: { code: methodCode, version: methodVersion },
    rulesPath,
    sectionsPath,
    outPath,
  });
}
