#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { normalizeStatus, parseRoadmapDirective, normalizePrId } from "./roadmap-lib.mjs";

const STATUS_ORDER = {
  planned: 1,
  next: 2,
  "in-progress": 3,
  blocked: 3,
  done: 4,
  merged: 4,
};

function isTerminalDone(status) {
  return status === "done" || status === "merged";
}

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

function parseOverrideBlock(body) {
  if (!body) return null;
  const normalized = String(body).replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const startIdx = lines.findIndex((line) => /^\s*###\s+Roadmap-Override\b/i.test(line));
  if (startIdx === -1) return null;
  const overrideLines = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*###\s+/i.test(line)) break;
    overrideLines.push(line);
  }

  const fields = {};
  for (const rawLine of overrideLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^\-?\s*([a-z_]+)\s*:\s*(.+)$/i);
    if (!match) continue;
    fields[match[1].toLowerCase()] = match[2].trim();
  }

  return fields;
}

function readOverridesLog() {
  const overridesPath = path.join("docs", "roadmaps", "OVERRIDES.md");
  if (!fs.existsSync(overridesPath)) return null;
  return fs.readFileSync(overridesPath, "utf8");
}

function hasOverrideEntry({ slug, pr, revertOf, reason }) {
  const content = readOverridesLog();
  if (!content) return false;
  const escapedReason = reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\d{4}-\\d{2}-\\d{2}\\s+\\|\\s+${slug}\\s+\\|\\s+${pr}\\s+\\|\\s+revert_of PR${revertOf}\\s+\\|\\s+${escapedReason}\\s*$`,
    "m",
  );
  return pattern.test(content);
}

const event = readEvent();
const pr = event?.pull_request ?? null;
const labels = (pr?.labels ?? []).map((label) => label?.name).filter(Boolean);
const body = pr?.body ?? "";
const directive = parseRoadmapDirective(body);

if (!directive) {
  console.log("roadmap-monotonic: no Roadmap-Update block; skipping");
  process.exit(0);
}

const slug = directive.slug?.trim() ?? null;
if (!slug || ["n/a", "na", "none"].includes(slug.toLowerCase())) {
  console.log("roadmap-monotonic: Roadmap-Update marked N/A; skipping");
  process.exit(0);
}

const statusPath = path.join("docs", "roadmaps", slug, "phase-status.json");
if (!fs.existsSync(statusPath)) {
  die(`roadmap-monotonic: missing ${statusPath}`);
}

const ssot = JSON.parse(fs.readFileSync(statusPath, "utf8"));
const evidence = ssot.pr_evidence ?? {};
const hasOverrideLabel = labels.includes("roadmap-override");
const hasHumanAckLabel = labels.includes("roadmap-human-ack");
const overrideFields = parseOverrideBlock(body);

for (const item of directive.items) {
  const prKey = normalizePrId(item.id);
  if (!prKey) continue;
  const newStatus = normalizeStatus(item.status);
  const oldStatus = normalizeStatus(ssot[prKey]);

  if (!newStatus || !oldStatus) continue;
  const newRank = STATUS_ORDER[newStatus] ?? 0;
  const oldRank = STATUS_ORDER[oldStatus] ?? 0;

  if (newStatus === "done" && !isTerminalDone(oldStatus)) {
    if (!hasHumanAckLabel) {
      die("roadmap-monotonic: setting done requires label 'roadmap-human-ack'.");
    }
    if (String(directive.ack ?? "").trim().toLowerCase() !== "human") {
      die("roadmap-monotonic: Roadmap-Update must include 'ack: human' when setting done.");
    }
    const ev = evidence[prKey];
    const ok = Array.isArray(ev) && ev.length > 0 && ev.every((num) => Number.isInteger(num) && num > 0);
    if (!ok) {
      die(`roadmap-monotonic: pr_evidence[${prKey}] missing or invalid while setting done.`);
    }
  }

  if (newRank < oldRank) {
    if (!hasOverrideLabel) {
      die(`roadmap-monotonic: ${prKey} regressed from ${oldStatus} to ${newStatus} without label 'roadmap-override'.`);
    }
    if (!overrideFields) {
      die("roadmap-monotonic: Roadmap-Override block required for regressions.");
    }

    const required = ["slug", "pr", "from_status", "to_status", "revert_of", "reason"];
    for (const key of required) {
      if (!overrideFields[key]) {
        die(`roadmap-monotonic: Roadmap-Override missing '${key}:'`);
      }
    }

    const overrideSlug = overrideFields.slug.trim();
    const overridePr = normalizePrId(overrideFields.pr);
    const fromStatus = normalizeStatus(overrideFields.from_status);
    const toStatus = normalizeStatus(overrideFields.to_status);
    const revertMatch = String(overrideFields.revert_of).trim().match(/^PR?(\d+)$/i);
    const revertOf = revertMatch ? revertMatch[1] : null;
    const reason = overrideFields.reason.trim();

    if (overrideSlug !== slug) {
      die(`roadmap-monotonic: Roadmap-Override slug '${overrideSlug}' does not match '${slug}'.`);
    }
    if (overridePr !== prKey) {
      die(`roadmap-monotonic: Roadmap-Override pr '${overrideFields.pr}' does not match '${prKey}'.`);
    }
    if (!fromStatus || fromStatus !== oldStatus) {
      die(`roadmap-monotonic: Roadmap-Override from_status '${overrideFields.from_status}' does not match '${oldStatus}'.`);
    }
    if (!toStatus || toStatus !== newStatus) {
      die(`roadmap-monotonic: Roadmap-Override to_status '${overrideFields.to_status}' does not match '${newStatus}'.`);
    }
    if (!revertOf) {
      die("roadmap-monotonic: Roadmap-Override revert_of must be PR number.");
    }
    if (!reason) {
      die("roadmap-monotonic: Roadmap-Override reason is required.");
    }

    if (!hasOverrideEntry({ slug, pr: prKey, revertOf, reason })) {
      die("roadmap-monotonic: OVERRIDES.md entry missing or invalid for this rollback.");
    }
  }
}

console.log("roadmap-monotonic: OK");
