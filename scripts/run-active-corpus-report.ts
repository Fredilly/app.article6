#!/usr/bin/env node
import path from "path";
import {
  runQuickCheckEvalCorpus,
  generateActiveCorpusReport,
  formatActiveCorpusReport,
} from "../src/lib/quickCheck/evalCorpus";

const reportFlagIndex = process.argv.indexOf("--report");
const manifestFlagIndex = process.argv.indexOf("--manifest");
const manifestPath = manifestFlagIndex >= 0 && process.argv[manifestFlagIndex + 1]
  ? path.resolve(process.argv[manifestFlagIndex + 1])
  : path.resolve(process.cwd(), "tests/fixtures/quick-check/corpus/phase6-eval-corpus.json");

const report = runQuickCheckEvalCorpus({
  manifestPath,
  repoRoot: process.cwd(),
});

const active = generateActiveCorpusReport(report);
console.log(formatActiveCorpusReport(active));
