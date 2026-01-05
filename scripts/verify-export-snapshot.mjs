import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node10" },
});
require("tsconfig-paths/register");

const extractStacArtifacts = require("../src/lib/export/extractStacArtifacts").default;
const buildProvenanceTxt = require("../src/lib/export/buildProvenanceTxt").default;
const { assertVerificationSnapshotInvariants } = require("../src/lib/export/assertVerificationSnapshotInvariants");

async function main() {
  const fixturesDir = path.join(process.cwd(), "src", "lib", "export", "__fixtures__");
  const runPath = path.join(fixturesDir, "stac_run_ok.json");
  const expectedProvenancePath = path.join(fixturesDir, "expected_provenance.txt");

  const selectedRun = JSON.parse(await readFile(runPath, "utf8"));
  const expectedProvenance = await readFile(expectedProvenancePath, "utf8");

  const stac = extractStacArtifacts({ runsForAoi: [selectedRun] });
  const provenanceText = buildProvenanceTxt({
    exported_at: "2026-01-01T00:00:00Z",
    app_git_sha: "fixture",
    method_code: selectedRun?.method?.code,
    method_version: selectedRun?.method?.version,
    aoi_id: selectedRun?.aoi_id,
    aoi_fingerprint: selectedRun?.aoi_fingerprint,
    stac_run_id: stac.stac_run_id,
    stac_status: stac.stac_status,
    stac_executed_at: stac.stac_executed_at,
    stac_item_count: stac.stac_item_count,
  });

  if (provenanceText !== expectedProvenance) {
    throw new Error(
      `Provenance snapshot mismatch.\nExpected fixture: ${expectedProvenancePath}\nRegenerate it after intentional changes.`,
    );
  }

  assertVerificationSnapshotInvariants({
    selectedRun: {
      id: String(selectedRun?.id ?? ""),
      status: String(selectedRun?.status ?? ""),
      ended_at: typeof selectedRun?.ended_at === "string" ? selectedRun.ended_at : undefined,
      created_at: typeof selectedRun?.created_at === "string" ? selectedRun.created_at : undefined,
      result_json: selectedRun?.result_json,
    },
    provenanceText,
    stacItems: stac.stac_items_json,
    evidence: stac.stac_evidence_geojson,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
