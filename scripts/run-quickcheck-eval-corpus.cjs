#!/usr/bin/env node
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
require("ts-node/register");
require("tsconfig-paths/register");

const path = require("path");
const {
  runQuickCheckEvalCorpus,
  formatQuickCheckEvalCorpusReport,
} = require("../src/lib/quickCheck/evalCorpus");

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

if (strict && report.metrics.regressionCount > 0) {
  process.exit(1);
}
