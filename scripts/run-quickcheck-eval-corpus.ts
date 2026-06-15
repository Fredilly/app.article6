#!/usr/bin/env node
import path from "path";
import {
  runQuickCheckEvalCorpus,
  formatQuickCheckEvalCorpusReport,
  checkEvalCorpusThresholds,
} from "../src/lib/quickCheck/evalCorpus";
import { loadEvalCorpusManifest } from "../src/lib/quickCheck/evalCorpus/manifest";
import { DEFAULT_STRICT_THRESHOLDS } from "../src/lib/quickCheck/evalCorpus/types";

const strict = process.argv.includes("--strict");
const manifestFlagIndex = process.argv.indexOf("--manifest");
const manifestPath = manifestFlagIndex >= 0 && process.argv[manifestFlagIndex + 1]
  ? path.resolve(process.argv[manifestFlagIndex + 1])
  : path.resolve(process.cwd(), "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json");

const report = runQuickCheckEvalCorpus({
  manifestPath,
  repoRoot: process.cwd(),
});

console.log(formatQuickCheckEvalCorpusReport(report));

if (strict) {
  const manifest = loadEvalCorpusManifest(manifestPath);
  const thresholds = manifest.thresholds ?? DEFAULT_STRICT_THRESHOLDS;
  const { passed, violations } = checkEvalCorpusThresholds(report, thresholds);

  if (!passed) {
    console.error("\nStrict eval corpus threshold violations:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log("\nAll strict eval corpus thresholds passed.");
}
