#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { listSsotFiles, normalizePrId } from "./roadmap-lib.mjs";

const ssotRoot = path.join("docs", "roadmaps");
const ssotFiles = listSsotFiles(ssotRoot);

if (!ssotFiles.length) {
  console.log("roadmap-validate: no SSOT files found");
  process.exit(0);
}

const byPr = new Map();

for (const ssotPath of ssotFiles) {
  const slug = path.basename(path.dirname(ssotPath));
  const raw = fs.readFileSync(ssotPath, "utf8");
  const data = JSON.parse(raw);
  for (const key of Object.keys(data)) {
    const normalized = normalizePrId(key);
    if (!normalized) continue;
    if (!byPr.has(normalized)) byPr.set(normalized, new Set());
    byPr.get(normalized).add(slug);
  }
}

const duplicates = Array.from(byPr.entries())
  .filter(([, slugs]) => slugs.size > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

if (!duplicates.length) {
  console.log("roadmap-validate: OK");
  process.exit(0);
}

console.error("roadmap-validate: duplicate PR keys across roadmaps");
for (const [prKey, slugs] of duplicates) {
  console.error(`- ${prKey}: ${Array.from(slugs).sort().join(", ")}`);
}
process.exit(1);
