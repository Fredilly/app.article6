#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SOURCE_ROOT = "src/lib/quickCheckV2";
const FIXTURE_ROOT = "tests/fixtures/quick-check/v2";

const PAGE_GATE_RE = /\b(?:[A-Za-z_$][\w$]*\.)*page\s*(?:===|==|!==|!=|>=|>|<=|<)\s*\d+\b/;
const METHODOLOGY_PAIR_RE = /\bVM0048\b[\s\S]{0,120}\bVM0007\b|\bVM0007\b[\s\S]{0,120}\bVM0048\b/;

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function parseArgs(argv) {
  const result = { baseRef: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === "--base-ref") {
      result.baseRef = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--base-ref=")) {
      result.baseRef = arg.slice("--base-ref=".length) || null;
    }
  }
  return result;
}

function resolveBaseRef(cliBaseRef) {
  if (cliBaseRef?.trim()) return cliBaseRef.trim();
  if (process.env.QUICKCHECK_NO_FIXTURE_HARDCODING_BASE?.trim()) return process.env.QUICKCHECK_NO_FIXTURE_HARDCODING_BASE.trim();
  if (process.env.QUICKCHECK_HARDCODING_BASE?.trim()) return process.env.QUICKCHECK_HARDCODING_BASE.trim();
  if (process.env.GITHUB_BASE_REF?.trim()) return `origin/${process.env.GITHUB_BASE_REF.trim()}`;
  return "origin/main";
}

function resolveChangedSourceFiles(baseRef) {
  const output = git(["diff", "--name-only", `${baseRef}...HEAD`, "--", SOURCE_ROOT]);
  return output ? output.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function readFixtureCatalog(rootDir) {
  const fixtureRoot = path.join(rootDir, FIXTURE_ROOT);
  const projectNames = new Set();
  const goldAnswers = new Set();

  if (!fs.existsSync(fixtureRoot)) {
    return { projectNames, goldAnswers };
  }

  for (const entry of fs.readdirSync(fixtureRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fixtureDir = path.join(fixtureRoot, entry.name);
    projectNames.add(entry.name.toLowerCase());

    const metaPath = path.join(fixtureDir, "meta.json");
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        for (const value of [meta?.id, meta?.title, meta?.documentId]) {
          if (typeof value === "string" && value.trim()) {
            projectNames.add(value.trim().toLowerCase());
          }
        }
      } catch {
        // Ignore malformed fixture metadata and keep scanning.
      }
    }

    const goldPath = path.join(fixtureDir, "gold.json");
    if (!fs.existsSync(goldPath)) continue;

    try {
      const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
      if (!Array.isArray(gold)) continue;
      for (const row of gold) {
        if (typeof row?.expectedAnswer === "string" && row.expectedAnswer.trim()) {
          goldAnswers.add(row.expectedAnswer.trim());
        }
      }
    } catch {
      // Ignore malformed gold files and keep scanning.
    }
  }

  return { projectNames, goldAnswers };
}

function parsePatch(patchText) {
  const lines = patchText.split("\n");
  const addedLines = [];
  let currentNewLine = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      currentNewLine = match ? Number(match[1]) : null;
      continue;
    }

    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git") || line.startsWith("index ")) {
      continue;
    }

    if (line.startsWith("+")) {
      addedLines.push({
        lineNumber: currentNewLine,
        text: line.slice(1),
      });
      if (currentNewLine != null) currentNewLine += 1;
      continue;
    }

    if (!line.startsWith("-") && currentNewLine != null) {
      currentNewLine += 1;
    }
  }

  return addedLines;
}

function collectViolations({ filePath, lineNumber, text }, catalog) {
  const violations = [];
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  if (PAGE_GATE_RE.test(normalized)) {
    violations.push({
      filePath,
      lineNumber,
      rule: "page gate",
      reason: "Page-threshold branching in quickCheckV2 source is fixture-shaped and brittle.",
      sample: normalized,
    });
  }

  if (METHODOLOGY_PAIR_RE.test(normalized)) {
    violations.push({
      filePath,
      lineNumber,
      rule: "methodology pair special case",
      reason: "Branching on a single methodology pair hardcodes fixture truth instead of parsing generically.",
      sample: normalized,
    });
  }

  for (const projectName of catalog.projectNames) {
    if (!projectName) continue;
    if (lower.includes(projectName)) {
      violations.push({
        filePath,
        lineNumber,
        rule: "project-specific fixture id/title",
        reason: `The source line mentions fixture-specific text (${projectName}), which should stay in fixtures or docs.`,
        sample: normalized,
      });
      break;
    }
  }

  for (const answer of catalog.goldAnswers) {
    if (!answer) continue;
    if (normalized.includes(answer)) {
      violations.push({
        filePath,
        lineNumber,
        rule: "exact gold answer string",
        reason: "An exact gold answer string is document-specific truth and should not be copied into source.",
        sample: normalized,
      });
      break;
    }
  }

  return violations;
}

function formatViolation(violation) {
  const location = violation.lineNumber ? `${violation.filePath}:${violation.lineNumber}` : violation.filePath;
  return [
    `[no-fixture-hardcoding] ${location}`,
    `rule=${violation.rule}`,
    violation.reason,
    `  ${violation.sample}`,
  ].join(" ");
}

function main() {
  try {
    const { baseRef: cliBaseRef } = parseArgs(process.argv.slice(2));
    const baseRef = resolveBaseRef(cliBaseRef);
    const rootDir = process.cwd();
    const changedSourceFiles = resolveChangedSourceFiles(baseRef);
    const catalog = readFixtureCatalog(rootDir);

    const violations = [];
    for (const filePath of changedSourceFiles) {
      const patchText = git(["diff", "--unified=0", "--no-color", `${baseRef}...HEAD`, "--", filePath]);
      if (!patchText) continue;

      const addedLines = parsePatch(patchText);
      for (const line of addedLines) {
        violations.push(...collectViolations({ filePath, lineNumber: line.lineNumber, text: line.text }, catalog));
      }
    }

    if (violations.length > 0) {
      console.error("[no-fixture-hardcoding] blocked");
      console.error(`[no-fixture-hardcoding] base=${baseRef} changed=${changedSourceFiles.length}`);
      for (const violation of violations) {
        console.error(formatViolation(violation));
      }
      process.exit(1);
    }

    console.log(`[no-fixture-hardcoding] ok base=${baseRef} changed=${changedSourceFiles.length}`);
  } catch (error) {
    console.error("[no-fixture-hardcoding] error");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
