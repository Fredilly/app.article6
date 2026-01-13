#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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

function extractSlugAndItem(title, body) {
  const slugMatch = title?.match(/\[RM:([^\]]+)]/i) || body?.match(/\bRoadmap:\s*([^\n]+)/i);
  const slug = slugMatch ? slugMatch[1].trim() : null;

  const itemMatch = title?.match(/\bPR\d+\b/) || body?.match(/\bRoadmap-Item:\s*(PR\d+)\b/i);
  const item = itemMatch ? itemMatch[1].trim().toUpperCase() : null;

  return { slug, item };
}

function getDiffFiles() {
  const base = process.env.GITHUB_BASE_REF;
  if (base) {
    return execSync(`git diff --name-only origin/${base}...HEAD`, { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return execSync("git diff --name-only HEAD~1", { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const event = readEvent();
const title = event?.pull_request?.title ?? "";
const body = event?.pull_request?.body ?? "";

const { slug, item } = extractSlugAndItem(title, body);

if (!slug || !item) {
  console.log("roadmap: no slug/item found; skipping");
  process.exit(0);
}

const statusPath = path.join("docs", "roadmaps", slug, "phase-status.json");

const diffFiles = getDiffFiles();
if (!diffFiles.includes(statusPath)) {
  die(
    `roadmap: ${statusPath} must be updated for ${item}. ` +
      "Set the item to in-progress or merged and include it in the PR diff.",
  );
}

if (!fs.existsSync(statusPath)) {
  die(`roadmap: missing ${statusPath}`);
}

let status;
try {
  status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
} catch {
  die(`roadmap: invalid JSON in ${statusPath}`);
}

const value = status[item];
if (value !== "in-progress" && value !== "merged") {
  die(
    `roadmap: ${statusPath} entry for ${item} must be in-progress or merged (found ${JSON.stringify(value)}).`,
  );
}

console.log(`roadmap: ${slug} ${item} status=${value}`);
