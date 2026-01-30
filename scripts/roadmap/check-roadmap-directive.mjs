import fs from "node:fs";
import { parseRoadmapDirective, normalizePrId } from "./roadmap-lib.mjs";

function extractPrNumberFromRef(ref) {
  const match = String(ref ?? "").match(/refs\/pull\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

async function fetchPrBody({ repoName, prNumber, token }) {
  if (!repoName || !prNumber || !token) {
    throw new Error(
      `fetchPrBody missing inputs repo=${repoName ?? "n/a"} prNumber=${prNumber ?? "n/a"} token=${
        token ? "present" : "missing"
      }`
    );
  }
  const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
  const resp = await fetch(`${apiBase}/repos/${repoName}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "roadmap-directive-gate",
    },
  });
  const text = await resp.text();
  if (!resp.ok) {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(`fetchPrBody failed status=${resp.status} ${resp.statusText} response="${snippet}"`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`fetchPrBody invalid JSON status=${resp.status}`);
  }
  return typeof data?.body === "string" ? data.body : "";
}

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

const prFromRef = extractPrNumberFromRef(process.env.GITHUB_REF);
const prNumber = pr?.number ?? event?.pull_request?.number ?? event?.number ?? prFromRef;
const repoName =
  process.env.GITHUB_REPOSITORY ?? pr?.base?.repo?.full_name ?? event?.repository?.full_name;
const token = process.env.GITHUB_TOKEN;

const labels = (pr.labels ?? []).map((l) => l?.name).filter(Boolean);
const hasPhase = labels.some((n) => String(n).startsWith("phase:"));
const hasPr = labels.some((n) => String(n).startsWith("pr:PR"));
const isRoadmapTracked = hasPhase || hasPr;

if (!isRoadmapTracked) {
  // Not a roadmap-tracked PR -> no requirement.
  process.exit(0);
}

const eventBody = pr?.body ?? "";
let body = eventBody;
let directive = parseRoadmapDirective(body);
let fetchedBodyLength = body.length;
console.log("[roadmap-directive] eventBodyLength=", eventBody.length);
console.log("[roadmap-directive] prNumber=", prNumber, "repo=", repoName);
if (!directive && prNumber && repoName) {
  try {
    const fetchedBody = await fetchPrBody({ repoName, prNumber, token });
    fetchedBodyLength = fetchedBody.length;
    if (typeof fetchedBody === "string" && fetchedBody.trim()) {
      body = fetchedBody;
      directive = parseRoadmapDirective(body);
    }
  } catch (error) {
    fail(`Unable to fetch PR body: ${error?.message ?? String(error)}`);
  }
}
console.log("[roadmap-directive] fetchedBodyLength=", fetchedBodyLength);

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
