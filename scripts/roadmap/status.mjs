#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeStatus, statusLabel } from "./roadmap-lib.mjs";

const ssotPath = path.join("docs", "roadmaps", "phase-assurance-surface-mvp", "phase-status.json");

if (!fs.existsSync(ssotPath)) {
  console.error(`missing ${ssotPath}`);
  process.exit(1);
}

const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
const items = Object.entries(ssot)
  .filter(([key]) => /^PR\d+$/i.test(key))
  .map(([key, value]) => ({ id: key.toUpperCase(), status: normalizeStatus(value) }))
  .sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2)));

for (const item of items) {
  console.log(`${item.id}: ${statusLabel(item.status)}`);
}
