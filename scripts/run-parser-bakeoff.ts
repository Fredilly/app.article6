#!/usr/bin/env node
import path from "path";
import { existsSync, readdirSync, statSync } from "fs";
import {
  runParserBakeoff,
  formatParserBakeoffScorecard,
  formatParserBakeoffScorecardJson,
} from "../src/lib/quickCheck/evalCorpus/bakeoff";

const repoRoot = process.cwd();

function collectPdfPaths(): string[] {
  const paths: string[] = [];

  const pdfDirFlagIndex = process.argv.indexOf("--pdfdir");
  if (pdfDirFlagIndex >= 0) {
    const dirPath = path.resolve(process.argv[pdfDirFlagIndex + 1] ?? "");
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      for (const entry of readdirSync(dirPath)) {
        if (entry.toLowerCase().endsWith(".pdf")) {
          paths.push(path.resolve(dirPath, entry));
        }
      }
    }
  }

  const pdfFlagIndexes: number[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--pdf" && process.argv[i + 1]) {
      pdfFlagIndexes.push(i);
    }
  }
  for (const idx of pdfFlagIndexes) {
    const pdfPath = path.resolve(process.argv[idx + 1]);
    if (!paths.includes(pdfPath)) {
      paths.push(pdfPath);
    }
  }

  if (paths.length > 0) {
    return paths;
  }

  const fixtureDir = path.resolve(repoRoot, "tests/fixtures/quick-check");
  return [
    path.resolve(fixtureDir, "plum-verra-demo-excerpt.pdf"),
    path.resolve(fixtureDir, "malawi-strong-signal-evidence.pdf"),
    path.resolve(fixtureDir, "kenya-second-check-evidence.pdf"),
  ].filter((p) => existsSync(p));
}

const pdfPaths = collectPdfPaths();

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
