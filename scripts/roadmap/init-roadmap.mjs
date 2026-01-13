#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/roadmap/init-roadmap.mjs --slug <slug> --title \"<Title>\" --items \"PR1,PR2\"");
  process.exit(1);
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const slug = getArg("--slug");
const title = getArg("--title");
const itemsRaw = getArg("--items");

if (!slug || !title || !itemsRaw) usage();

const items = itemsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!items.length) usage();

const root = path.join(process.cwd(), "docs", "roadmaps", slug);
fs.mkdirSync(root, { recursive: true });

const roadmapPath = path.join(root, "ROADMAP.md");
const decisionsPath = path.join(root, "DECISIONS.md");
const statusPath = path.join(root, "phase-status.json");

if (!fs.existsSync(roadmapPath)) {
  const checklist = items.map((item) => `- [ ] ${item}: planned`).join("\n");
  const content = `# ${title}\n\n## Items\n\n${checklist}\n`;
  fs.writeFileSync(roadmapPath, content, "utf8");
}

if (!fs.existsSync(decisionsPath)) {
  const content = "# Decisions\n\n";
  fs.writeFileSync(decisionsPath, content, "utf8");
}

if (!fs.existsSync(statusPath)) {
  const status = {};
  for (const item of items) status[item] = "planned";
  fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

console.log(`Initialized roadmap at ${path.relative(process.cwd(), root)}`);
