#!/usr/bin/env node
import { execSync } from "node:child_process";
import process from "node:process";

const CANON_SCHEMA_PATHS = new Set([
  "schemas/artifacts/rules.rich.schema.json",
  "schemas/artifacts/sections.rich.schema.json",
  "src/integrity/schemas/rulesRich.schema.json",
  "src/integrity/schemas/sectionsRich.schema.json",
]);

const VENDORED_METHODOLOGY_PATH_PREFIXES = [
  "public/methodologies/",
  "public/_provenance/methodologies_PROVENANCE.json",
];

const APPROVED_SYNC_BRANCH_PREFIXES = [
  "sync/methodologies-",
  "chore/sync-methodologies-",
  "chore/methodologies-sync-",
];

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tryRun(command) {
  try {
    return run(command);
  } catch {
    return "";
  }
}

function resolveBaseRef() {
  if (process.env.METHODOLOGY_BOUNDARY_BASE?.trim()) return process.env.METHODOLOGY_BOUNDARY_BASE.trim();
  if (process.env.GITHUB_BASE_REF?.trim()) return `origin/${process.env.GITHUB_BASE_REF.trim()}`;
  return "origin/main";
}

function resolveChangedFiles(baseRef) {
  const output = tryRun(`git diff --name-only ${baseRef}...HEAD`);
  return output ? output.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function isApprovedMethodologySyncBranch(branchName) {
  return Boolean(branchName) && APPROVED_SYNC_BRANCH_PREFIXES.some((prefix) => branchName.startsWith(prefix));
}

function evaluateBoundary({ changedFiles, branchName, allowMethodologySync }) {
  const approvedSyncPath = Boolean(allowMethodologySync) || isApprovedMethodologySyncBranch(branchName);
  const blockedCanonSchemaFiles = changedFiles.filter((filePath) => CANON_SCHEMA_PATHS.has(filePath));
  const blockedVendoredMethodologyFiles = approvedSyncPath
    ? []
    : changedFiles.filter((filePath) =>
        VENDORED_METHODOLOGY_PATH_PREFIXES.some((prefix) =>
          prefix.endsWith(".json") ? prefix === filePath : filePath.startsWith(prefix),
        ),
      );

  const messages = [];
  if (blockedCanonSchemaFiles.length) {
    messages.push(
      [
        "Canonical methodology schema edits are not owned by app.article6.",
        "Open the schema/artifact change upstream in article6-methodologies first, then update app consumer compatibility separately.",
        `Blocked files: ${blockedCanonSchemaFiles.join(", ")}`,
      ].join(" "),
    );
  }
  if (blockedVendoredMethodologyFiles.length) {
    messages.push(
      [
        "Vendored methodology pack files cannot be edited directly in normal app PRs.",
        "Use an approved methodologies sync path instead.",
        "Approved paths: set ALLOW_METHODOLOGY_SYNC=1 or use a sync branch prefix",
        `(${APPROVED_SYNC_BRANCH_PREFIXES.join(", ")}).`,
        `Blocked files: ${blockedVendoredMethodologyFiles.join(", ")}`,
      ].join(" "),
    );
  }

  return { allowed: messages.length === 0, messages };
}

function main() {
  const baseRef = resolveBaseRef();
  const branchName = tryRun("git rev-parse --abbrev-ref HEAD");
  const changedFiles = resolveChangedFiles(baseRef);
  const result = evaluateBoundary({
    allowMethodologySync: process.env.ALLOW_METHODOLOGY_SYNC === "1",
    branchName,
    changedFiles,
  });

  if (!result.allowed) {
    console.error("[methodology-boundary] blocked");
    console.error(`[methodology-boundary] base=${baseRef} branch=${branchName || "(unknown)"}`);
    for (const message of result.messages) console.error(`[methodology-boundary] ${message}`);
    process.exit(1);
  }

  console.log(
    `[methodology-boundary] ok base=${baseRef} branch=${branchName || "(unknown)"} changed=${changedFiles.length}`,
  );
}

main();
