#!/usr/bin/env node
import path from "path";
import {
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
  collectPdfPaths,
} from "../src/lib/quickCheck/evalCorpus/bakeoff";

const repoRoot = process.cwd();

const pdfPaths = collectPdfPaths(process.argv, repoRoot);

const manifestFlagIndex = process.argv.indexOf("--manifest");
const manifestPath = manifestFlagIndex >= 0 && process.argv[manifestFlagIndex + 1]
  ? path.resolve(process.argv[manifestFlagIndex + 1])
  : undefined;

const jsonFlag = process.argv.includes("--json");

const scorecard = runParserBakeoff({
  pdfPaths,
  manifestPath,
  repoRoot,
});

if (jsonFlag) {
  console.log(formatParserBakeoffScorecardJson(scorecard));
} else {
  console.log(formatParserBakeoffScorecard(scorecard));
}
