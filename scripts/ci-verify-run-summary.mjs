import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node10" },
});
require("tsconfig-paths/register");

const { buildRunSummary } = require("../src/lib/verify/runState");
const { deriveRunKpis } = require("../src/lib/verify/kpis");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const fixturePath = path.join(process.cwd(), "fixtures", "verify", "ci-run-fixture.json");
  const raw = JSON.parse(await readFile(fixturePath, "utf8"));

  assert(raw && typeof raw === "object", "CI fixture missing or invalid.");
  assert(raw.method?.code, "CI fixture missing method.code.");
  assert(raw.method?.version, "CI fixture missing method.version.");
  assert(raw.summary, "CI fixture missing summary.");

  const summary = buildRunSummary(raw.summary);
  const kpis = deriveRunKpis(summary, { totalRules: raw.method.totalRules ?? null });
  const repoCommit = process.env.GITHUB_SHA ?? "unknown";
  const generatedAt = new Date().toISOString();

  const output = {
    repoCommit,
    generatedAt,
    method: {
      code: raw.method.code,
      version: raw.method.version,
    },
    aoi: summary.aoi,
    stac: {
      query: summary.stac.query,
      itemIds: summary.stac.itemIds,
    },
    linkage: summary.linkage,
    kpis,
  };

  assert(output.kpis.itemsCount === summary.stac.itemIds.length, "itemsCount mismatch in KPI derivation.");
  assert(output.kpis.linkedRulesCount === summary.linkage.linkedRuleIds.length, "linkedRulesCount mismatch in KPI derivation.");

  const outDir = path.join(process.cwd(), "artifacts", "verify");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "ci-run-summary.json");
  await writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
