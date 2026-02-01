import path from "node:path";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function pickString(record, keys) {
  if (!record || typeof record !== "object") return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function collectRuleIds(rulesJson) {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === "object" && Array.isArray(rulesJson.rules)
      ? rulesJson.rules
      : rulesJson && typeof rulesJson === "object"
        ? Object.values(rulesJson)
        : [];
  const ids = items
    .map((item) => (item && typeof item === "object" ? pickString(item, ["id", "rule_id", "ruleId", "key"]) : null))
    .filter((id) => typeof id === "string");
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
}

function roundRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}

async function loadCoverageFromSummary(summaryPath) {
  const data = await readJson(summaryPath);
  const coverage = data?.kpis?.coverage ?? null;
  if (!coverage || typeof coverage.numerator !== "number" || typeof coverage.denominator !== "number") {
    return null;
  }
  return { covered: coverage.numerator, total: coverage.denominator, source: "summary", data };
}

async function loadCoverageFromFixture(fixturePath) {
  const data = await readJson(fixturePath);
  const total = data?.method?.totalRules;
  const linked = data?.summary?.linkage?.linkedRuleIds;
  if (typeof total !== "number" || !Array.isArray(linked)) return null;
  return { covered: linked.length, total, source: "fixture", data };
}

async function main() {
  const summaryPath = path.join(process.cwd(), "artifacts", "verify", "ci-run-summary.json");
  const fixturePath = path.join(process.cwd(), "fixtures", "verify", "ci-run-fixture.json");
  const manifestPath = path.join(process.cwd(), "public", "manifest", "index.json");
  const rulesRoot = path.join(process.cwd(), "public");

  let coverage = null;
  try {
    await access(summaryPath, fsConstants.F_OK);
    coverage = await loadCoverageFromSummary(summaryPath);
  } catch {
    coverage = null;
  }

  if (!coverage) {
    coverage = await loadCoverageFromFixture(fixturePath);
  }

  if (!coverage) {
    throw new Error("Coverage input missing: expected artifacts/verify/ci-run-summary.json or fixtures/verify/ci-run-fixture.json.");
  }

  const data = coverage.data ?? {};
  const methodCode =
    data?.method?.code ??
    data?.method?.methodCode ??
    data?.summary?.provenance?.methodCode ??
    data?.provenance?.methodCode ??
    null;
  const methodVersion =
    data?.method?.version ??
    data?.method?.methodVersion ??
    data?.summary?.provenance?.version ??
    data?.provenance?.version ??
    null;

  let totalUnits = [];
  let unitSource = "synthetic";
  let rulesPath = null;
  try {
    const manifest = await readJson(manifestPath);
    if (Array.isArray(manifest) && methodCode && methodVersion) {
      const entry = manifest.find(
        (item) => item?.methodology === methodCode && item?.version === methodVersion && typeof item?.path === "string",
      );
      if (entry?.path) {
        rulesPath = path.join(rulesRoot, entry.path);
        const rulesJson = await readJson(rulesPath);
        totalUnits = collectRuleIds(rulesJson);
        if (totalUnits.length) unitSource = "manifest";
      }
    }
  } catch {
    unitSource = "synthetic";
  }

  if (!totalUnits.length) {
    totalUnits = Array.from({ length: coverage.total }, (_, idx) => `RULE_${idx + 1}`);
  }

  if (process.env.COVERAGE_DEBUG === "1") {
    const linkedRuleIds =
      (Array.isArray(data?.linkage?.linkedRuleIds) && data.linkage.linkedRuleIds) ||
      (Array.isArray(data?.summary?.linkage?.linkedRuleIds) && data.summary.linkage.linkedRuleIds) ||
      [];
    const linkedSorted = Array.from(new Set(linkedRuleIds.filter((id) => typeof id === "string"))).sort((a, b) => a.localeCompare(b));

    const totalSet = new Set(totalUnits);
    const coveredUnits = unitSource === "manifest" ? linkedSorted.filter((id) => totalSet.has(id)) : linkedSorted;
    const coveredSet = new Set(coveredUnits);
    const uncoveredUnits = totalUnits.filter((id) => !coveredSet.has(id));

    console.log("[coverage-debug] source:", coverage.source);
    console.log("[coverage-debug] method:", `${methodCode ?? "unknown"}@${methodVersion ?? "unknown"}`);
    console.log("[coverage-debug] unit_source:", unitSource);
    if (rulesPath) console.log("[coverage-debug] rules_path:", rulesPath);
    console.log("[coverage-debug] total_units_count:", totalUnits.length);
    console.log("[coverage-debug] total_units_head:", JSON.stringify(totalUnits.slice(0, 10)));
    console.log("[coverage-debug] covered_units:", JSON.stringify(coveredUnits));
    console.log("[coverage-debug] uncovered_units:", JSON.stringify(uncoveredUnits.slice(0, 10)));
    if (uncoveredUnits.length) {
      console.log("[coverage-debug] uncovered_reasons:");
      for (const id of uncoveredUnits.slice(0, 10)) {
        const reason = unitSource === "manifest"
          ? "not linked in run summary"
          : "rules.json missing or method/version not found in manifest";
        console.log(`- ${id}: ${reason}`);
      }
    }
  }

  const ratio = coverage.total > 0 ? coverage.covered / coverage.total : 0;
  const output = {
    version: 1,
    overall: {
      covered: coverage.covered,
      total: coverage.total,
      ratio: roundRatio(ratio),
    },
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
