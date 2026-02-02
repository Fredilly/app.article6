#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const status = (getArg("status") ?? "").trim();
const slug = (getArg("slug") ?? "").trim();
const pr = (getArg("pr") ?? "").trim();
const fromStatus = (getArg("from-status") ?? "").trim();
const toStatus = (getArg("to-status") ?? "").trim();
const revertOf = (getArg("revert-of") ?? "").trim();
const reason = (getArg("reason") ?? "").trim();
const override = process.argv.includes("--override");

if (status.toLowerCase() === "done") {
  console.log('reminder: add label "roadmap-human-ack" and include "ack: human" in Roadmap-Update.');
}

if (!override) process.exit(0);

if (!slug || !pr || !fromStatus || !toStatus || !revertOf || !reason) {
  console.error("Usage: node scripts/roadmap/roadmap-update.mjs --override --slug <slug> --pr PRxx --from-status <old> --to-status <new> --revert-of <PR#> --reason <reason>");
  process.exit(1);
}

const overrideBlock = [
  "### Roadmap-Override",
  `slug: ${slug}`,
  `pr: ${pr}`,
  `from_status: ${fromStatus}`,
  `to_status: ${toStatus}`,
  `revert_of: ${revertOf}`,
  `reason: ${reason}`,
  "",
].join("\n");

console.log(overrideBlock);

const overridesPath = path.join("docs", "roadmaps", "OVERRIDES.md");
const today = new Date().toISOString().slice(0, 10);
const line = `${today} | ${slug} | ${pr} | revert_of PR${revertOf.replace(/^PR/i, "")} | ${reason}`;
const header = [
  "# Roadmap Overrides (append-only)",
  "",
  "Each line records a manual rollback approved via `roadmap-override`.",
  "",
  "Format:",
  "`YYYY-MM-DD | <slug> | PRxx | revert_of PR# | reason`",
  "",
].join("\n");

if (!fs.existsSync(overridesPath)) {
  fs.writeFileSync(overridesPath, `${header}${line}\n`, "utf8");
} else {
  const existing = fs.readFileSync(overridesPath, "utf8");
  const trimmed = existing.endsWith("\n") ? existing : `${existing}\n`;
  fs.writeFileSync(overridesPath, `${trimmed}${line}\n`, "utf8");
}
