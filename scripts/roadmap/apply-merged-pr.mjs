#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  generateRoadmapContent,
  getRoadmapItemStatus,
  normalizePrId,
  normalizeStatus,
  parseRoadmapDirective,
  setRoadmapItemStatus,
} from "./roadmap-lib.mjs";
import { finalizeMergedItems } from "./finalize-merged.mjs";

const ALLOWED_STATUSES = new Set(["planned", "next", "in-progress", "done", "blocked"]);

function die(message) {
  console.error(message);
  process.exit(1);
}

function readEvent(eventPath) {
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }
}

function updateSsotStatus(ssot, ssotPath, updates) {
  const next = JSON.parse(JSON.stringify(ssot));
  for (const { id, status } of updates) {
    if (!setRoadmapItemStatus(next, id, status)) {
      die(`roadmap: cannot map ${id} into ${ssotPath}`);
    }
  }

  const entries = Object.entries(next);
  const prEntries = entries
    .filter(([key]) => /^PR\d+$/i.test(key))
    .sort((a, b) => Number(a[0].slice(2)) - Number(b[0].slice(2)));
  const otherEntries = entries.filter(([key]) => !/^PR\d+$/i.test(key)).sort();
  const ordered = Object.fromEntries([...prEntries, ...otherEntries]);
  fs.writeFileSync(ssotPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
}

function getPhaseSlug(labels, directiveSlug) {
  const phaseLabels = labels.filter((label) => label.startsWith("phase:"));
  if (phaseLabels.length === 1) {
    const slug = phaseLabels[0].slice("phase:".length).trim();
    if (!slug) die("roadmap: phase label missing slug.");
    return slug;
  }
  if (directiveSlug?.trim()) return directiveSlug.trim();
  if (phaseLabels.length !== 1) {
    die(`roadmap: expected exactly one phase:* label, found ${phaseLabels.length}.`);
  }
  return null;
}

const args = process.argv.slice(2);
const eventFlag = args.indexOf("--event");
const eventPath = eventFlag >= 0 ? args[eventFlag + 1] : null;

if (!eventPath) {
  die("Usage: node scripts/roadmap/apply-merged-pr.mjs --event <event.json>");
}

const event = readEvent(eventPath);
const pr = event?.pull_request ?? event?.pull_request;
const labels = (pr?.labels ?? []).map((label) => label?.name).filter(Boolean);
const body = pr?.body ?? "";
const hasDirective = body.includes("### Roadmap-Update");
if (!hasDirective) {
  console.log("roadmap: skip (no Roadmap-Update directive)");
  process.exit(0);
}
const prNumber = pr?.number ?? "unknown";
const directive = parseRoadmapDirective(body);
if (!directive) {
  console.log("roadmap: no Roadmap-Update block found; skipping");
  process.exit(0);
}

const slug = directive.slug?.trim();
if (!slug || ["n/a", "na", "none"].includes(slug.toLowerCase())) {
  console.log("roadmap: Roadmap-Update marked N/A; skipping");
  process.exit(0);
}

if (!directive.items.length) {
  die("roadmap: Roadmap-Update requires at least one item.");
}

const phaseSlug = getPhaseSlug(labels, slug);

const ssotPath = path.join("docs", "roadmaps", phaseSlug, "phase-status.json");
if (!fs.existsSync(ssotPath)) {
  die(`roadmap: missing ${ssotPath}`);
}

const prLabel = labels.find((label) => label.startsWith("pr:PR")) ?? null;
const labeledPrKey = prLabel ? normalizePrId(prLabel.replace("pr:", "")) : null;

const finalized = finalizeMergedItems(directive.items, labeledPrKey);
const updates = finalized.items.map((item) => {
  const normalized = normalizeStatus(item.status);
  if (!normalized || !ALLOWED_STATUSES.has(normalized)) {
    die(`roadmap: invalid status for ${item.id} (${item.status}).`);
  }
  return { id: item.id, status: normalized };
});

if (finalized.prKey && !updates.some((item) => item.id === finalized.prKey)) {
  updates.push({ id: finalized.prKey, status: "done" });
}

if (!updates.length) {
  console.log("roadmap: no items to update; skipping");
  process.exit(0);
}

const existing = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
const changed = updates.some(({ id, status }) => getRoadmapItemStatus(existing, id) !== status);
if (!changed) {
  console.log("roadmap: no status changes needed; skipping");
  process.exit(0);
}

updateSsotStatus(existing, ssotPath, updates);

const docsRoot = "docs";
const ssotRoot = path.join(docsRoot, "roadmaps");
const roadmapPath = path.join(docsRoot, "roadmaps", "SUMMARY.md");
const content = generateRoadmapContent(ssotRoot, docsRoot).trim() + "\n";
fs.writeFileSync(roadmapPath, content, "utf8");

console.log(`roadmap: updated ${ssotPath} + ${roadmapPath} from PR #${prNumber}`);
