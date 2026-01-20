#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateRoadmapContent, listSsotFiles, normalizeStatus } from "./roadmap/roadmap-lib.mjs";

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

function die(messages) {
  for (const message of messages) console.error(message);
  process.exit(1);
}

const ssotRoot = path.join("docs", "roadmaps");
if (!fs.existsSync(ssotRoot)) {
  console.log("status:check: no roadmap directory found; skipping");
  process.exit(0);
}

const ssotFiles = listSsotFiles(ssotRoot);
const errors = [];

const docsRoot = "docs";
const canonicalRoadmapPath = path.join(docsRoot, "projects", "ROADMAP.md");
if (fs.existsSync(docsRoot)) {
  const roadmapFiles = listFiles(docsRoot, (file) => path.basename(file).toLowerCase() === "roadmap.md");
  if (roadmapFiles.length !== 1) {
    errors.push(
      `status:check: expected exactly 1 ROADMAP.md in docs, found ${roadmapFiles.length}`,
    );
    for (const hit of roadmapFiles) {
      errors.push(`status:check: ROADMAP.md: ${hit}`);
    }
  } else if (path.normalize(roadmapFiles[0]) !== path.normalize(canonicalRoadmapPath)) {
    errors.push(
      `status:check: canonical ROADMAP.md must be ${canonicalRoadmapPath} (found ${roadmapFiles[0]})`,
    );
  }
}

for (const ssotPath of ssotFiles) {
  const slug = path.basename(path.dirname(ssotPath));
  const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
  const prStatuses = Object.fromEntries(
    Object.entries(ssot)
      .filter(([key]) => /^PR\d+$/i.test(key))
      .map(([key, value]) => [key.toUpperCase(), normalizeStatus(value)]),
  );

  const projectStatusPath = path.join("docs", "projects", slug, "phase-status.json");
  if (fs.existsSync(projectStatusPath)) {
    const projectStatus = JSON.parse(fs.readFileSync(projectStatusPath, "utf8"));
    const items = Array.isArray(projectStatus.prs) ? projectStatus.prs : [];
    for (const item of items) {
      const id = typeof item.id === "string" ? item.id.toUpperCase() : null;
      if (!id || !prStatuses[id]) continue;
      const expected = prStatuses[id];
      const actual = normalizeStatus(item.status);
      if (expected !== actual) {
        errors.push(
          `status:check: ${projectStatusPath} ${id}=${actual} disagrees with SSOT ${ssotPath}=${expected}`,
        );
      }
    }
  }
}

if (fs.existsSync(canonicalRoadmapPath)) {
  const expected = generateRoadmapContent(ssotRoot, docsRoot).trim() + "\n";
  const actual = fs.readFileSync(canonicalRoadmapPath, "utf8");
  if (actual !== expected) {
    errors.push(`status:check: ${canonicalRoadmapPath} must be generated from SSOT (run roadmap auto-update).`);
  }
}

if (errors.length) die(errors);
console.log("status:check: OK");
