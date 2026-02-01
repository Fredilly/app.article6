import path from "node:path";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const DEBUG = process.env.COVERAGE_DEBUG === "1";

function debugLog(message) {
  if (DEBUG) console.log(message);
}

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

function roundRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}

function pickString(record, keys) {
  if (!record || typeof record !== "object") return undefined;
  for (const key of keys) {
    const value = record[key];
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
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

function buildSyntheticRuleIds(total) {
  return Array.from({ length: total }, (_, idx) => `RULE_${idx + 1}`);
}

async function loadCoverageFromSummary(summaryPath) {
  const data = await readJson(summaryPath);
  const coverage = data?.kpis?.coverage ?? null;
  if (!coverage || typeof coverage.numerator !== "number" || typeof coverage.denominator !== "number") {
    return null;
  }
  return { data, coverage: { covered: coverage.numerator, total: coverage.denominator } };
}

async function loadCoverageFromFixture(fixturePath) {
  const data = await readJson(fixturePath);
  const total = data?.method?.totalRules;
  const linked = data?.summary?.linkage?.linkedRuleIds;
  if (typeof total !== "number" || !Array.isArray(linked)) return null;
  return { data, coverage: { covered: linked.length, total } };
}

async function resolveRuleIdsFromManifest(methodCode, methodVersion) {
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  if (!(await fileExists(manifestPath))) {
    return { unitSource: "synthetic", reason: "manifest index missing" };
  }

  const manifest = await readJson(manifestPath);
  if (!Array.isArray(manifest)) {
    return { unitSource: "synthetic", reason: "manifest index invalid" };
  }

  const entry = manifest.find(
    (item) => item?.methodology === methodCode && item?.version === methodVersion && typeof item?.path === "string",
  );

  if (!entry?.path) {
    return { unitSource: "synthetic", reason: "method/version not found in manifest" };
  }

  const rulesPath = path.join(process.cwd(), "public", entry.path);
  if (!(await fileExists(rulesPath))) {
    return { unitSource: "synthetic", reason: "rules.json missing", rulesPath };
  }

  const rulesJson = await readJson(rulesPath);
  const ruleIds = collectRuleIds(rulesJson);
  if (ruleIds.length === 0) {
    return { unitSource: "synthetic", reason: "rules.json empty", rulesPath };
  }

  return { unitSource: "manifest", ruleIds, rulesPath };
}

async function main() {
  const summaryPath = path.join(process.cwd(), "artifacts", "verify", "ci-run-summary.json");
  const fixturePath = path.join(process.cwd(), "fixtures", "verify", "ci-run-fixture.json");

  let coverage = null;
  let data = null;
  let source = "unknown";

  if (await fileExists(summaryPath)) {
    const result = await loadCoverageFromSummary(summaryPath);
    if (result) {
      ({ data, coverage } = result);
      source = "summary";
    }
  }

  if (!coverage) {
    const result = await loadCoverageFromFixture(fixturePath);
    if (result) {
      ({ data, coverage } = result);
      source = "fixture";
    }
  }

  if (!coverage) {
    throw new Error(
      "Coverage input missing: expected artifacts/verify/ci-run-summary.json or fixtures/verify/ci-run-fixture.json.",
    );
  }

  const methodCode =
    pickString(data?.method, ["code", "methodCode", "method_code"]) ??
    pickString(data?.summary?.provenance, ["methodCode", "method_code", "methodology"]);
  const methodVersion =
    pickString(data?.method, ["version", "methodVersion"]) ??
    pickString(data?.summary?.provenance, ["version", "methodVersion"]);

  const linkedRuleIds =
    (Array.isArray(data?.linkage?.linkedRuleIds) && data.linkage.linkedRuleIds) ||
    (Array.isArray(data?.summary?.linkage?.linkedRuleIds) && data.summary.linkage.linkedRuleIds) ||
    [];
  const linkedSet = new Set(linkedRuleIds.filter((id) => typeof id === "string"));

  let totalUnits = [];
  let unitSource = "synthetic";
  let unitSourceReason = "";
  let rulesPathUsed = null;

  if (methodCode && methodVersion) {
    const resolved = await resolveRuleIdsFromManifest(methodCode, methodVersion);
    unitSource = resolved.unitSource;
    unitSourceReason = resolved.reason ?? "";
    rulesPathUsed = resolved.rulesPath ?? null;
    if (Array.isArray(resolved.ruleIds) && resolved.ruleIds.length > 0) {
      totalUnits = resolved.ruleIds;
    }
  }

  if (totalUnits.length === 0) {
    totalUnits = buildSyntheticRuleIds(coverage.total);
    unitSource = "synthetic";
    if (!unitSourceReason) unitSourceReason = "rule ids unavailable";
  }

  const coveredUnits = totalUnits.filter((ruleId) => linkedSet.has(ruleId));
  const uncoveredUnits = totalUnits.filter((ruleId) => !linkedSet.has(ruleId));

  if (DEBUG) {
    debugLog(`[coverage] source=${source}`);
    debugLog(`[coverage] method=${methodCode ?? "unknown"}@${methodVersion ?? "unknown"}`);
    debugLog(`[coverage] unit_source=${unitSource}`);
    if (rulesPathUsed) debugLog(`[coverage] rules_path=${rulesPathUsed}`);
    if (unitSource !== "manifest") debugLog(`[coverage] unit_source_reason=${unitSourceReason}`);
    debugLog(`[coverage] total_units=${totalUnits.length}`);
    debugLog(`[coverage] total_units_list=${totalUnits.join(", ") || "—"}`);
    debugLog(`[coverage] covered_units=${coveredUnits.join(", ") || "—"}`);
    debugLog(`[coverage] uncovered_units=${uncoveredUnits.join(", ") || "—"}`);
    for (const ruleId of uncoveredUnits) {
      debugLog(`[coverage] uncovered_reason ${ruleId}: not linked`);
    }
  }

  const ratio = coverage.total > 0 ? coverage.covered / coverage.total : 0;
  const methodCodeForRecords = methodCode ?? "unknown";
  const methodVersionForRecords = methodVersion ?? "unknown";
  const rules = totalUnits.map((ruleId) => ({
    method_code: methodCodeForRecords,
    version: methodVersionForRecords,
    ruleId,
    status: linkedSet.has(ruleId) ? "covered" : "uncovered",
    strength: linkedSet.has(ruleId) ? 1 : 0,
    source: "linkage",
    updated_at: null,
    notes: null,
  }));

  const output = {
    version: 1,
    overall: {
      covered: coverage.covered,
      total: coverage.total,
      ratio: roundRatio(ratio),
    },
    rules,
  };

  const outDir = path.join(process.cwd(), "artifacts", "ci");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "coverage.json");
  await writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
