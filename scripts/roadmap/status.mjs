#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { formatPrId, normalizePrId, normalizeStatus, prSortKey, statusLabel } from "./roadmap-lib.mjs";

const ssotPath = path.join("docs", "roadmaps", "phase-assurance-surface-mvp", "phase-status.json");

if (!fs.existsSync(ssotPath)) {
  console.error(`missing ${ssotPath}`);
  process.exit(1);
}

const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
const items = Object.entries(ssot)
  .map(([key, value]) => ({ id: normalizePrId(key), status: normalizeStatus(value) }))
  .filter((item) => item.id)
  .map((item) => ({ id: item.id, status: item.status }))
  .sort((a, b) => {
    const [aMain, aSub] = prSortKey(a.id);
    const [bMain, bSub] = prSortKey(b.id);
    if (aMain !== bMain) return aMain - bMain;
    return aSub - bSub;
  });

for (const item of items) {
  console.log(`${formatPrId(item.id)}: ${statusLabel(item.status)}`);
}
