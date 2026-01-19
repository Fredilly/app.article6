#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const STATUS_TOKENS = [
  { re: /\b(in[-_\s]?progress)\b/i, status: "in-progress" },
  { re: /\b(done|complete|completed)\b/i, status: "done" },
  { re: /\b(merged)\b/i, status: "merged" },
  { re: /\b(planned)\b/i, status: "planned" },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFiles(root, matcher) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (matcher(current)) out.push(current);
  }
  return out;
}

function normalizePrStatus(value) {
  if (!value) return null;
  const lowered = String(value).trim().toLowerCase();
  if (["in-progress", "in_progress", "in progress"].includes(lowered)) return "in-progress";
  if (["done", "complete", "completed"].includes(lowered)) return "done";
  if (["merged"].includes(lowered)) return "merged";
  if (["planned"].includes(lowered)) return "planned";
  return lowered;
}

function collectStatusClaims(line) {
  for (const token of STATUS_TOKENS) {
    if (token.re.test(line)) return token.status;
  }
  return null;
}

function die(messages) {
  for (const message of messages) console.error(message);
  process.exit(1);
}

const ssotRoot = path.join("docs", "roadmaps");
if (!fs.existsSync(ssotRoot)) {
  console.log("status:check: no roadmap directory found; skipping");
  process.exit(0);
}

const ssotFiles = listFiles(ssotRoot, (file) => file.endsWith("phase-status.json"));
const errors = [];

for (const ssotPath of ssotFiles) {
  const slug = path.basename(path.dirname(ssotPath));
  const ssot = readJson(ssotPath);
  const prStatuses = Object.fromEntries(
    Object.entries(ssot)
      .filter(([key]) => /^PR\d+$/i.test(key))
      .map(([key, value]) => [key.toUpperCase(), normalizePrStatus(value)]),
  );

  const projectStatusPath = path.join("docs", "projects", slug, "phase-status.json");
  if (fs.existsSync(projectStatusPath)) {
    const projectStatus = readJson(projectStatusPath);
    const items = Array.isArray(projectStatus.prs) ? projectStatus.prs : [];
    for (const item of items) {
      const id = typeof item.id === "string" ? item.id.toUpperCase() : null;
      if (!id || !prStatuses[id]) continue;
      const expected = prStatuses[id];
      const actual = normalizePrStatus(item.status);
      if (expected !== actual) {
        errors.push(
          `status:check: ${projectStatusPath} ${id}=${actual} disagrees with SSOT ${ssotPath}=${expected}`,
        );
      }
    }
  }

  const docRoot = path.join("docs", "projects", slug);
  if (!fs.existsSync(docRoot)) continue;
  const mdFiles = listFiles(
    docRoot,
    (file) => /ROADMAP.*\.md$/i.test(file) || /CHECKLIST.*\.md$/i.test(file),
  );
  for (const mdPath of mdFiles) {
    const lines = fs.readFileSync(mdPath, "utf8").split("\n");
    lines.forEach((line, idx) => {
      const match = line.match(/\bPR\d+\b/gi);
      if (!match) return;
      const statusClaim = collectStatusClaims(line);
      if (!statusClaim) return;
      for (const rawId of match) {
        const id = rawId.toUpperCase();
        const expected = prStatuses[id];
        if (!expected) continue;
        if (expected !== statusClaim) {
          errors.push(
            `status:check: ${mdPath}:${idx + 1} ${id}=${statusClaim} disagrees with SSOT ${ssotPath}=${expected}`,
          );
        }
      }
    });
  }
}

if (errors.length) die(errors);
console.log("status:check: OK");
