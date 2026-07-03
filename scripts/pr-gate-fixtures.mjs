#!/usr/bin/env node
/**
 * pr:gate:fixtures — Fast fixture-only validation gate.
 *
 * Runs only checks relevant to fixture correctness.
 * Intentionally excludes heavy/irrelevant checks (PDF smoke, eval corpus, etc.).
 *
 * Full npm run pr:gate is still required before merge / in CI.
 */
import { execSync } from "node:child_process";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  // 1. Fixture quality gate (the core contract checker)
  run("npx jest tests/lib/preverif/fixtureQualityGate.test.ts --runInBand");

  // 2. VM0007 judgment fixture tests
  run("npx jest tests/lib/preverif.vm0007PdReddJudgmentFixtures.test.ts --runInBand");
  run("npx jest tests/lib/preverif.vm0007EnviraJudgmentFixtures.test.ts --runInBand");

  // 3. Full 58-rule audit fixture shape test
  run("npx jest tests/lib/preverif.vm0007FullAuditFixtureShape.test.ts --runInBand");

  // 4. Report fixture layer tests
  run("npx jest tests/lib/preverif.vm0007GapReport.test.ts --runInBand");
  run("npx jest tests/lib/preverif.vm0007EvidenceAudit.test.ts --runInBand");
  run("npx jest tests/lib/preverif.vm0007EvidenceContracts.test.ts --runInBand");

  // 5. Lint (fast, always worth running)
  run("npm run lint");

  // 6. Typecheck (fast, always worth running)
  run("npm run typecheck");

  console.log("\n✓ pr:gate:fixtures passed");
}

main();
