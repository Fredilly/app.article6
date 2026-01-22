import fs from "node:fs";
import { parseRoadmapDirective, normalizePrId } from "./roadmap-lib.mjs";

/**
 * Fail-closed rule:
 * If PR is roadmap-tracked (has phase:* label), require a valid Roadmap-Update block.
 *
 * We read PR metadata from the GitHub event payload (pull_request).
 */
function fail(msg) {
  console.error(`roadmap-directive-gate: ${msg}`);
  process.exit(1);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  fail("GITHUB_EVENT_PATH missing (expected in GitHub Actions).");
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const pr = event.pull_request;
if (!pr) {
  // Not a PR event; do nothing.
  process.exit(0);
}

const labels = (pr.labels ?? []).map((l) => l?.name).filter(Boolean);
const hasPhase = labels.some((n) => String(n).startsWith("phase:"));
const hasPr = labels.some((n) => String(n).startsWith("pr:PR"));
const isRoadmapTracked = hasPhase || hasPr;

if (!isRoadmapTracked) {
  // Not a roadmap-tracked PR -> no requirement.
  process.exit(0);
}

const body = pr.body ?? "";
const directive = parseRoadmapDirective(body);
if (directive && !(hasPhase && hasPr)) {
  fail("Roadmap-Update is only allowed on roadmap PRs (requires phase:* and pr:PRxx labels).");
}

if (!directive) {
  fail("Missing '### Roadmap-Update' block in PR body (roadmap-tracked PR).");
}

const slug = directive.slug?.trim();
if (!slug) fail("Roadmap-Update block missing 'slug: <slug>'.");

const items = directive.items ?? [];
if (!items.length) fail("Roadmap-Update block missing items (e.g., '- PR18: in_progress').");

// Optional cross-check: if there's a pr:PRxx label, require it appears in items.
const prLabel = labels.find((n) => String(n).startsWith("pr:PR"));
if (prLabel) {
  const expected = normalizePrId(prLabel.replace("pr:", ""));
  const has = items.some((it) => normalizePrId(it.id) === expected);
  if (!has) {
    fail(`PR has label '${prLabel}' but Roadmap-Update items do not include ${expected}.`);
  }
}

// Optional cross-check: if there's a phase:<slug> label, require slug matches.
const phaseLabel = labels.find((n) => String(n).startsWith("phase:"));
if (phaseLabel) {
  const expectedSlug = phaseLabel.replace("phase:", "").trim();
  if (expectedSlug && expectedSlug !== slug) {
    fail(`PR has label '${phaseLabel}' but Roadmap-Update slug is '${slug}'.`);
  }
}

console.log("roadmap-directive-gate: OK");
