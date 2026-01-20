#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateRoadmapContent, normalizeStatus, parseRoadmapDirective } from "./roadmap-lib.mjs";

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

function updateSsotStatus(ssotPath, updates) {
  const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
  const next = { ...ssot };
  for (const { id, status } of updates) {
    next[id] = status;
  }
  next.updated_at = new Date().toISOString();

  const entries = Object.entries(next);
  const prEntries = entries
    .filter(([key]) => /^PR\d+$/i.test(key))
    .sort((a, b) => Number(a[0].slice(2)) - Number(b[0].slice(2)));
  const otherEntries = entries.filter(([key]) => !/^PR\d+$/i.test(key) && key !== "updated_at").sort();
  const ordered = Object.fromEntries([...prEntries, ...otherEntries, ["updated_at", next.updated_at]]);
  fs.writeFileSync(ssotPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
}

const args = process.argv.slice(2);
const eventFlag = args.indexOf("--event");
const eventPath = eventFlag >= 0 ? args[eventFlag + 1] : null;

if (!eventPath) {
  die("Usage: node scripts/roadmap/apply-merged-pr.mjs --event <event.json>");
}

const event = readEvent(eventPath);
const body = event?.pull_request?.body ?? "";
const prNumber = event?.pull_request?.number ?? "unknown";

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

const ssotPath = path.join("docs", "roadmaps", slug, "phase-status.json");
if (!fs.existsSync(ssotPath)) {
  die(`roadmap: missing ${ssotPath}`);
}

const updates = directive.items.map((item) => {
  const normalized = normalizeStatus(item.status);
  if (!normalized || !ALLOWED_STATUSES.has(normalized)) {
    die(`roadmap: invalid status for ${item.id} (${item.status}).`);
  }
  return { id: item.id, status: normalized };
});

updateSsotStatus(ssotPath, updates);

const docsRoot = "docs";
const ssotRoot = path.join(docsRoot, "roadmaps");
const roadmapPath = path.join(docsRoot, "projects", "ROADMAP.md");
const content = generateRoadmapContent(ssotRoot, docsRoot).trim() + "\n";
fs.writeFileSync(roadmapPath, content, "utf8");

console.log(`roadmap: updated ${ssotPath} + ${roadmapPath} from PR #${prNumber}`);
