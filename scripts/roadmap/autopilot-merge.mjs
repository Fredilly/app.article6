#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  generateRoadmapContent,
  parseRoadmapDirective,
  normalizePrId,
  normalizeStatus,
} from "./roadmap-lib.mjs";
import { inferPrKey } from "./infer-pr-key.mjs";
import { finalizeMergedItems } from "./finalize-merged.mjs";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function updateSsotStatus(ssot, ssotPath, updates) {
  const next = { ...ssot, ...updates };

  const entries = Object.entries(next);
  const prEntries = entries
    .filter(([key]) => /^PR\d+$/i.test(key))
    .sort((a, b) => Number(a[0].slice(2)) - Number(b[0].slice(2)));
  const otherEntries = entries.filter(([key]) => !/^PR\d+$/i.test(key)).sort();
  const ordered = Object.fromEntries([...prEntries, ...otherEntries]);

  fs.writeFileSync(ssotPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
}

function writeOutput(outputPath, payload) {
  if (!outputPath) return;
  const lines = Object.entries(payload)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");
  fs.appendFileSync(outputPath, lines + "\n", "utf8");
}

function getPhaseSlug(labels) {
  const phaseLabels = labels.filter((label) => label.startsWith("phase:"));
  if (phaseLabels.length !== 1) {
    console.error(`roadmap: expected exactly one phase:* label, found ${phaseLabels.length}.`);
    process.exit(1);
  }
  const slug = phaseLabels[0].slice("phase:".length).trim();
  if (!slug) {
    console.error("roadmap: phase label missing slug.");
    process.exit(1);
  }
  return slug;
}

const eventPath = getArg("--event");
const outputPath = getArg("--output");

if (!eventPath) {
  console.error("Usage: node scripts/roadmap/autopilot-merge.mjs --event <event.json>");
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pr = event.pull_request ?? event?.pull_request ?? {};
const labels = (pr?.labels ?? []).map((label) => label?.name).filter(Boolean);
const body = pr?.body ?? "";
const hasDirective = body.includes("### Roadmap-Update");
if (!hasDirective) {
  console.log("roadmap: skip (no Roadmap-Update directive)");
  process.exit(0);
}

const prKey = inferPrKey({
  title: pr.title ?? "",
  body,
  branch: pr.head?.ref ?? "",
});
const phaseSlug = getPhaseSlug(labels);
const prLabel = labels.find((label) => label.startsWith("pr:PR")) ?? null;
const labeledPrKey = prLabel ? normalizePrId(prLabel.replace("pr:", "")) : null;
const directive = parseRoadmapDirective(body);

if (!prKey && !directive) {
  const payload = { status: "skipped", reason: "no pr key or directive" };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

const ssotInfo = { ssotPath: path.join("docs", "roadmaps", phaseSlug, "phase-status.json"), slug: phaseSlug };

if (!fs.existsSync(ssotInfo.ssotPath)) {
  const payload = { status: "skipped", reason: "missing SSOT", prKey: prKey ?? "", slug: ssotInfo.slug };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

const updates = {};
const finalized = finalizeMergedItems(directive?.items ?? [], labeledPrKey ?? prKey);
for (const item of finalized.items) {
  if (item.id) updates[item.id] = item.status;
}
if (finalized.prKey && !updates[finalized.prKey]) {
  updates[finalized.prKey] = "done";
}
if (!Object.keys(updates).length) {
  const payload = { status: "skipped", reason: "no items", prKey: prKey ?? "", slug: ssotInfo.slug };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

const existing = JSON.parse(fs.readFileSync(ssotInfo.ssotPath, "utf8"));
const changed = Object.entries(updates).some(([key, value]) => {
  return normalizeStatus(existing[key]) !== normalizeStatus(value);
});
if (!changed) {
  const payload = { status: "skipped", reason: "no changes", prKey: prKey ?? "", slug: ssotInfo.slug };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

updateSsotStatus(existing, ssotInfo.ssotPath, updates);

const docsRoot = "docs";
const ssotRoot = path.join(docsRoot, "roadmaps");
const roadmapPath = path.join(docsRoot, "projects", "ROADMAP.md");
const content = generateRoadmapContent(ssotRoot, docsRoot).trim() + "\n";
fs.writeFileSync(roadmapPath, content, "utf8");

const payload = {
  status: "updated",
  prKey: finalized.prKey ?? prKey ?? "",
  ssotPath: ssotInfo.ssotPath,
  roadmapPath,
  slug: ssotInfo.slug,
};
writeOutput(outputPath, payload);
console.log(JSON.stringify(payload));
