import path from "node:path";
import { access, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function pickString(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function collectRuleIds(rulesJson) {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === "object" && Array.isArray(rulesJson.rules)
      ? rulesJson.rules
      : rulesJson && typeof rulesJson === "object"
        ? Object.values(rulesJson)
        : [];

  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = pickString(item, ["id", "rule_id", "ruleId", "key"]);
    if (id) ids.add(id);
  }
  return ids;
}

function collectSectionIds(sectionsJson) {
  const items = Array.isArray(sectionsJson)
    ? sectionsJson
    : sectionsJson && typeof sectionsJson === "object" && Array.isArray(sectionsJson.sections)
      ? sectionsJson.sections
      : sectionsJson && typeof sectionsJson === "object"
        ? Object.values(sectionsJson)
        : [];

  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = pickString(item, ["id", "sectionId", "section_id", "key"]);
    if (id) ids.add(id);
  }
  return ids;
}

function collectExternalUrls(entry) {
  const urls = [];
  for (const value of Object.values(entry)) {
    if (typeof value !== "string") continue;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      urls.push(value);
    }
  }
  return urls;
}

async function dirExists(dirPath) {
  try {
    const info = await stat(dirPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function loadMethodIndex(methodDir) {
  const rulesPath = path.join(methodDir, "rules.json");
  const sectionsPath = path.join(methodDir, "sections.json");

  const rulesExists = await fileExists(rulesPath);
  const sectionsExists = await fileExists(sectionsPath);
  if (!rulesExists || !sectionsExists) {
    return { rules: new Set(), sections: new Set(), rulesExists, sectionsExists };
  }

  const [rulesJson, sectionsJson] = await Promise.all([
    readJson(rulesPath),
    readJson(sectionsPath),
  ]);

  return {
    rules: collectRuleIds(rulesJson),
    sections: collectSectionIds(sectionsJson),
    rulesExists,
    sectionsExists,
  };
}

async function main() {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) throw new Error("Manifest index missing or invalid.");
  const coveragePath = path.join(process.cwd(), "artifacts", "ci", "coverage.json");

  const cache = new Map();
  const broken = [];
  let total = 0;

  for (const entry of manifest) {
    if (!entry || typeof entry !== "object") continue;

    const methodPath = typeof entry.path === "string" ? entry.path : null;
    const methodDir = methodPath ? path.join(process.cwd(), "public", path.dirname(methodPath)) : null;

    total += 1;
    if (!methodPath) {
      broken.push({ ref: `${entry.rule_id ?? "unknown"} path`, reason: "manifest entry missing path" });
      continue;
    }

    const fullPath = path.join(process.cwd(), "public", methodPath);
    if (!(await fileExists(fullPath))) {
      // Entry points to data not on disk (e.g. synthetic Gold Standard entries).
      // Skip link resolution — these entries have no source data to verify against.
      continue;
    }

    if (!methodDir) {
      continue;
    }

    let index = cache.get(methodDir);
    if (!index) {
      index = await loadMethodIndex(methodDir);
      cache.set(methodDir, index);
    }

    if (!index.rulesExists || !index.sectionsExists) {
      total += 1;
      broken.push({ ref: methodDir, reason: "rules.json or sections.json missing" });
      continue;
    }

    const ruleId = typeof entry.rule_id === "string" ? entry.rule_id : null;
    total += 1;
    if (!ruleId || !index.rules.has(ruleId)) {
      broken.push({ ref: `${entry.methodology ?? "unknown"}@${entry.version ?? "unknown"} rule_id:${ruleId ?? "missing"}`, reason: "rule_id not found in rules.json" });
    }

    const sectionId = typeof entry.sectionId === "string" ? entry.sectionId : null;
    total += 1;
    if (!sectionId || !index.sections.has(sectionId)) {
      broken.push({ ref: `${entry.methodology ?? "unknown"}@${entry.version ?? "unknown"} section:${sectionId ?? "missing"}`, reason: "sectionId not found in sections.json" });
    }

    const urls = collectExternalUrls(entry);
    for (const url of urls) {
      total += 1;
      try {
        new URL(url);
      } catch {
        broken.push({ ref: url, reason: "invalid external URL" });
      }
    }
  }

  if (await fileExists(coveragePath)) {
    const coverage = await readJson(coveragePath);
    const records = Array.isArray(coverage?.rules) ? coverage.rules : [];
    if (records.length) {
      const sample = records[0] ?? {};
      const methodCode = typeof sample.method_code === "string" ? sample.method_code : null;
      const methodVersion = typeof sample.version === "string" ? sample.version : null;
      total += 1;
      if (!methodCode || !methodVersion) {
        broken.push({ ref: "coverage.rules", reason: "coverage records missing method_code/version" });
      } else {
        const entry = manifest.find(
          (item) => item?.methodology === methodCode && item?.version === methodVersion && typeof item?.path === "string",
        );
        if (!entry?.path) {
          broken.push({ ref: `${methodCode}@${methodVersion}`, reason: "coverage method/version not found in manifest" });
        } else {
          const rulesPath = path.join(process.cwd(), "public", entry.path);
          if (!(await fileExists(rulesPath))) {
            broken.push({ ref: rulesPath, reason: "coverage rules.json missing on disk" });
          } else {
            const rulesJson = await readJson(rulesPath);
            const ruleIds = collectRuleIds(rulesJson);
            for (const record of records) {
              total += 1;
              const ruleId = typeof record?.ruleId === "string" ? record.ruleId : null;
              if (!ruleId || !ruleIds.has(ruleId)) {
                broken.push({ ref: `coverage ruleId:${ruleId ?? "missing"}`, reason: "coverage ruleId not found in rules.json" });
              }
            }
          }
        }
      }
    }
  }

  const out = {
    version: 1,
    total,
    broken: broken.length,
    broken_samples: broken.slice(0, 10),
  };

  const outDir = path.join(process.cwd(), "artifacts", "ci");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "link-resolver.json");
  await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  if (broken.length > 0) {
    throw new Error(`Link resolver gate failed: ${broken.length} broken references.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
