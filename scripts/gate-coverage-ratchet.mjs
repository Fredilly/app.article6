import path from "node:path";
import { readFile } from "node:fs/promises";

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function assertNumber(value, message) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(message);
  }
}

async function main() {
  const baselinePath = path.join(process.cwd(), "docs", "roadmaps", "verification-factory", "coverage-ratchet.json");
  const coveragePath = path.join(process.cwd(), "artifacts", "ci", "coverage.json");

  const baseline = await readJson(baselinePath);
  const coverage = await readJson(coveragePath);

  const ratio = coverage?.overall?.ratio;
  const min = baseline?.baseline?.overall_min;
  const tolerance = typeof baseline?.tolerance === "number" ? baseline.tolerance : 0;

  assertNumber(ratio, "coverage.json missing overall.ratio");
  assertNumber(min, "coverage-ratchet.json missing baseline.overall_min");

  const threshold = min - tolerance;
  if (ratio < threshold) {
    throw new Error(
      `Coverage ratchet failed: ratio=${ratio} below baseline=${min} (tolerance=${tolerance}).`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
