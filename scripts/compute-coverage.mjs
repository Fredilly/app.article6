import path from "node:path";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
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
  return { covered: coverage.numerator, total: coverage.denominator };
}

async function loadCoverageFromFixture(fixturePath) {
  const data = await readJson(fixturePath);
  const total = data?.method?.totalRules;
  const linked = data?.summary?.linkage?.linkedRuleIds;
  if (typeof total !== "number" || !Array.isArray(linked)) return null;
  return { covered: linked.length, total };
}

async function main() {
  const summaryPath = path.join(process.cwd(), "artifacts", "verify", "ci-run-summary.json");
  const fixturePath = path.join(process.cwd(), "fixtures", "verify", "ci-run-fixture.json");

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
