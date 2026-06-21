#!/usr/bin/env node
import path from "path";
import { existsSync } from "fs";
import {
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
} from "../src/lib/quickCheck/evalCorpus/bakeoff";

const repoRoot = process.cwd();

const fixtureDir = path.resolve(repoRoot, "tests/fixtures/quick-check");
const pdfGlob = process.argv.find((a) => a.endsWith(".pdf"));
const pdfPaths = pdfGlob
  ? [path.resolve(pdfGlob)]
  : [
      path.resolve(fixtureDir, "plum-verra-demo-excerpt.pdf"),
      path.resolve(fixtureDir, "malawi-strong-signal-evidence.pdf"),
      path.resolve(fixtureDir, "kenya-second-check-evidence.pdf"),
    ].filter((p) => existsSync(p));

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
