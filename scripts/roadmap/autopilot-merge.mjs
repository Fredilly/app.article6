#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateRoadmapContent } from "./roadmap-lib.mjs";
import { inferPrKey } from "./infer-pr-key.mjs";
import { findSsotForPr } from "./find-ssot-for-pr.mjs";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function updateSsotStatus(ssotPath, prKey) {
  const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
  const next = { ...ssot, [prKey]: "done" };
  next.updated_at = new Date().toISOString();

  const entries = Object.entries(next);
  const prEntries = entries
    .filter(([key]) => /^PR\d+$/i.test(key))
    .sort((a, b) => Number(a[0].slice(2)) - Number(b[0].slice(2)));
  const otherEntries = entries.filter(([key]) => !/^PR\d+$/i.test(key) && key !== "updated_at").sort();
  const ordered = Object.fromEntries([...prEntries, ...otherEntries, ["updated_at", next.updated_at]]);

  fs.writeFileSync(ssotPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
}

function writeOutput(outputPath, payload) {
  if (!outputPath) return;
  const lines = Object.entries(payload)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");
  fs.appendFileSync(outputPath, lines + "\n", "utf8");
}

const eventPath = getArg("--event");
const outputPath = getArg("--output");

if (!eventPath) {
  console.error("Usage: node scripts/roadmap/autopilot-merge.mjs --event <event.json>");
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pr = event.pull_request ?? {};

const prKey = inferPrKey({
  title: pr.title ?? "",
  body: pr.body ?? "",
  branch: pr.head?.ref ?? "",
});

if (!prKey) {
  const payload = { status: "skipped", reason: "no pr key" };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

let ssotInfo;
try {
  ssotInfo = findSsotForPr(prKey);
} catch (error) {
  const reason = error && error.code === "AMBIGUOUS" ? "ambiguous" : "not in SSOT";
  const payload = { status: "skipped", reason, prKey };
  writeOutput(outputPath, payload);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

updateSsotStatus(ssotInfo.ssotPath, prKey);

const docsRoot = "docs";
const ssotRoot = path.join(docsRoot, "roadmaps");
const roadmapPath = path.join(docsRoot, "projects", "ROADMAP.md");
const content = generateRoadmapContent(ssotRoot, docsRoot).trim() + "\n";
fs.writeFileSync(roadmapPath, content, "utf8");

const payload = {
  status: "updated",
  prKey,
  ssotPath: ssotInfo.ssotPath,
  roadmapPath,
  slug: ssotInfo.slug,
};
writeOutput(outputPath, payload);
console.log(JSON.stringify(payload));
