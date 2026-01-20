#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeStatus, parseRoadmapDirective } from "./roadmap-lib.mjs";

function die(message) {
  console.error(message);
  process.exit(1);
}

function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }
}

const ALLOWED_STATUSES = new Set(["planned", "next", "in-progress", "done", "blocked"]);

const event = readEvent();
const title = event?.pull_request?.title ?? "";
const body = event?.pull_request?.body ?? "";

const directive = parseRoadmapDirective(body);
const legacyHint =
  /\bRoadmap:\s*/i.test(body) ||
  /\bRoadmap-Item:\s*/i.test(body) ||
  /\[RM:[^\]]+\]/i.test(title);

if (!directive) {
  if (legacyHint) {
    die("roadmap: Roadmap-Update block missing from PR body.");
  }
  console.log("roadmap: no Roadmap-Update block; skipping");
  process.exit(0);
}

const slug = directive.slug?.trim();
if (!slug) {
  die("roadmap: Roadmap-Update missing slug.");
}
if (["n/a", "na", "none"].includes(slug.toLowerCase())) {
  console.log("roadmap: Roadmap-Update marked N/A; skipping");
  process.exit(0);
}

if (!directive.items.length) {
  die("roadmap: Roadmap-Update requires at least one item.");
}

const statusPath = path.join("docs", "roadmaps", slug, "phase-status.json");

if (!fs.existsSync(statusPath)) {
  die(`roadmap: missing ${statusPath}`);
}

for (const item of directive.items) {
  const normalized = normalizeStatus(item.status);
  if (!normalized || !ALLOWED_STATUSES.has(normalized)) {
    die(`roadmap: invalid status for ${item.id} (${item.status}).`);
  }
}

console.log(`roadmap: ${slug} ${directive.items.length} item(s) validated`);
