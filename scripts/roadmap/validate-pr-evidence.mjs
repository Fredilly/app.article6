import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "docs", "roadmaps");

function isRoadmapKey(key) {
  return /^PR\d+(_\d+)?$/.test(key);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isDoneStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return status === "done" || status === "merged";
}

const slugs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

let failed = false;

for (const slug of slugs) {
  const statusPath = path.join(ROOT, slug, "phase-status.json");
  if (!fs.existsSync(statusPath)) continue;

  const json = readJson(statusPath);
  const evidence = json.pr_evidence ?? {};

  for (const [key, value] of Object.entries(json)) {
    if (!isRoadmapKey(key)) continue;
    if (!isDoneStatus(value)) continue;

    const ev = evidence[key];
    const ok =
      Array.isArray(ev) && ev.length > 0 && ev.every((num) => Number.isInteger(num) && num > 0);
    if (!ok) {
      console.error(`[roadmap] ${slug}: ${key} is done but pr_evidence[${key}] is missing/empty/invalid`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("[roadmap] pr evidence OK");
