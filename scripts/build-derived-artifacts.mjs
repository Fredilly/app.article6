#!/usr/bin/env node
import path from "node:path";
import { mkdir, readFile, writeFile, access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { stableStringify, sortById } from "./_stable-json.mjs";

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function extractList(input, key) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input[key])) return input[key];
  return [];
}

function pickString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function dirExists(dirPath) {
  try {
    const info = await stat(dirPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function collectDatasets(manifest) {
  const map = new Map();
  for (const entry of manifest) {
    if (!entry || typeof entry !== "object") continue;
    const methodCode = entry.methodology;
    const version = entry.version;
    const rulesPath = entry.path;
    if (!methodCode || !version || !rulesPath) continue;
    const key = `${methodCode}@${version}`;
    if (map.has(key)) continue;
    const baseDir = path.join(process.cwd(), "public", path.dirname(rulesPath));
    if (!(await dirExists(baseDir))) continue;
    map.set(key, { methodCode, version, baseDir });
  }
  return Array.from(map.values());
}

function buildRichAnchorMap(richJson) {
  const rules = extractList(richJson, "rules");
  const map = new Map();
  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const id = pickString(rule.id ?? rule.rule_id ?? rule.ruleId);
    const anchor = pickString(rule.anchor ?? rule.rule_anchor ?? rule.anchor_id);
    if (id && anchor) map.set(id, anchor);
  }
  return map;
}

function buildRuleIndex({ rulesJson, richJson }) {
  const rules = extractList(rulesJson, "rules");
  const richAnchors = richJson ? buildRichAnchorMap(richJson) : new Map();
  const output = [];

  for (const rule of rules) {
    if (!rule || typeof rule !== "object") continue;
    const ruleId = pickString(rule.id ?? rule.rule_id ?? rule.ruleId);
    if (!ruleId) continue;
    const anchor = pickString(rule.anchor ?? rule.rule_anchor ?? rule.anchor_id) ?? richAnchors.get(ruleId) ?? null;
    const sectionRef = pickString(rule.section_ref ?? rule.sectionRef ?? rule.section_ref_id);
    const sectionId = pickString(rule.section_id ?? rule.sectionId);
    const entry = {
      rule_id: ruleId,
      anchor: anchor ?? undefined,
      section_ref: sectionRef ?? undefined,
      section_id: sectionId ?? undefined,
    };
    output.push(entry);
  }

  return output.sort(sortById);
}

async function main() {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  if (!(await fileExists(manifestPath))) {
    throw new Error("Derived artifacts: manifest index missing.");
  }
  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) {
    throw new Error("Derived artifacts: manifest index invalid.");
  }

  const datasets = await collectDatasets(manifest);

  for (const dataset of datasets) {
    const metaPath = path.join(dataset.baseDir, "META.json");
    const rulesPath = path.join(dataset.baseDir, "rules.json");
    const sectionsPath = path.join(dataset.baseDir, "sections.json");
    const richPath = path.join(dataset.baseDir, "rich.json");

    if (!(await fileExists(metaPath))) {
      throw new Error(`Derived artifacts: missing META.json at ${metaPath}`);
    }
    if (!(await fileExists(rulesPath))) {
      throw new Error(`Derived artifacts: missing rules.json at ${rulesPath}`);
    }
    if (!(await fileExists(sectionsPath))) {
      throw new Error(`Derived artifacts: missing sections.json at ${sectionsPath}`);
    }

    const metaJson = await readJson(metaPath);
    const rulesJson = await readJson(rulesPath);
    const sectionsJson = await readJson(sectionsPath);
    const richJson = (await fileExists(richPath)) ? await readJson(richPath) : null;

    const rulesList = extractList(rulesJson, "rules");
    const sectionsList = extractList(sectionsJson, "sections");

    const source = pickString(metaJson?.provenance?.author ?? metaJson?.provenance?.source);
    const generated =
      pickString(metaJson?.generated_at) ??
      pickString(metaJson?.provenance?.date) ??
      pickString(metaJson?.audit?.created_at);

    const summary = {
      method_code: dataset.methodCode,
      version: dataset.version,
      counts: {
        rules: rulesList.length,
        sections: sectionsList.length,
      },
      source: source ?? null,
      generated: generated ?? null,
    };

    const ruleIndex = buildRuleIndex({ rulesJson, richJson });

    const derivedDir = path.join(dataset.baseDir, "derived");
    await mkdir(derivedDir, { recursive: true });

    await writeFile(path.join(derivedDir, "summary.json"), stableStringify(summary), "utf8");
    await writeFile(path.join(derivedDir, "rule_index.json"), stableStringify(ruleIndex), "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
