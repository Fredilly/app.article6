#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ALLOWED_STATUSES = new Set(["planned", "in_progress", "done", "completed", "blocked", "deferred", "not_started"]);
const DONE_STATUSES = new Set(["done", "completed"]);
const ACTIVE_STATUSES = new Set(["in_progress"]);
const BLOCKED_STATUSES = new Set(["blocked"]);

// Uppercased key prefixes that we skip (RC0, RC1, etc.); everything under "phases" is what matters.
const SKIP_KEYS = new Set(["phase_meta"]);
const PR_PATTERN = /^RC\d+$/;

function isPrStatusKey(key) {
  return PR_PATTERN.test(key);
}

function die(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) die(`Missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    die(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

function normalizeStatus(value) {
  if (!value) return null;
  const lowered = String(value).trim().toLowerCase();
  const map = {
    "in_progress": "in_progress",
    "in-progress": "in_progress",
    "in progress": "in_progress",
    done: "done",
    completed: "done",
    complete: "done",
    planned: "planned",
    blocked: "blocked",
    deferred: "deferred",
    not_started: "not_started",
    "not started": "not_started",
  };
  return map[lowered] ?? null;
}

function statusLabel(status) {
  const labels = {
    done: "Done",
    completed: "Done",
    in_progress: "In progress",
    planned: "Planned",
    blocked: "Blocked",
    deferred: "Deferred",
    not_started: "Not started",
  };
  return labels[status] ?? status ?? "Unknown";
}

function validatePhases(ssot, errors) {
  const phases = ssot.phases;
  if (!phases || typeof phases !== "object" || Array.isArray(phases)) {
    errors.push("ssot.phases: must be a non-empty object");
    return [];
  }

  const entries = Object.entries(phases);
  if (entries.length === 0) {
    errors.push("ssot.phases: must define at least one phase");
    return [];
  }

  for (const [key, phase] of entries) {
    if (!phase || typeof phase !== "object") {
      errors.push(`phases.${key}: must be an object`);
      continue;
    }

    if (!key.startsWith("phase_")) {
      errors.push(`phases.${key}: key should start with "phase_"`);
    }

    if (!phase.status) {
      errors.push(`phases.${key}: missing "status"`);
    } else {
      const normalized = normalizeStatus(phase.status);
      if (!normalized || !ALLOWED_STATUSES.has(normalized)) {
        errors.push(`phases.${key}: invalid status "${phase.status}"`);
      }
    }

    if (!phase.title) {
      errors.push(`phases.${key}: missing "title"`);
    }

    if (phase.depends_on !== undefined && !Array.isArray(phase.depends_on)) {
      errors.push(`phases.${key}: "depends_on" must be an array`);
    }
  }

  return entries;
}

function checkPreconditions(ssot, entries, warnings) {
  const phaseMap = new Map(entries);

  for (const [key, phase] of entries) {
    const deps = phase.depends_on;
    if (!Array.isArray(deps) || deps.length === 0) continue;

    const normalized = normalizeStatus(phase.status);
    if (!normalized) continue;

    const blocked = [];
    for (const depKey of deps) {
      const depPhase = phaseMap.get(depKey);
      if (!depPhase) {
        blocked.push(`  Dependency ${depKey}: not found — manual review needed`);
        continue;
      }
      const depStatus = normalizeStatus(depPhase.status);
      if (!depStatus || !DONE_STATUSES.has(depStatus)) {
        blocked.push(`  Dependency ${depKey} ("${depPhase.title}"): status is "${depPhase.status}" not done`);
      }
    }

    if (blocked.length > 0) {
      warnings.push(`Phase "${key}" ("${phase.title}") — ${statusLabel(normalized)}:`);
      for (const reason of blocked) {
        warnings.push(reason);
      }
    }
  }
}

function computeCompletion(phase) {
  const normalized = normalizeStatus(phase.status);
  if (!normalized) return 0;
  const map = { done: 100, completed: 100, in_progress: 50, planned: 10, not_started: 0, blocked: 25, deferred: 5 };
  return map[normalized] ?? 0;
}

function nextAction(phaseKey, phase, allDone) {
  const normalized = normalizeStatus(phase.status);
  if (!normalized) return "Fix invalid status";
  switch (normalized) {
    case "done":
    case "completed":
      return "Done — no action";
    case "in_progress":
      return "Continue implementation; check PRs for completion";
    case "blocked":
      return "Resolve blockers and dependencies";
    case "deferred":
      return "Review when to un-defer";
    case "planned":
      return allDone ? "Ready to start — move to in_progress" : "Waiting on dependencies";
    case "not_started":
      return allDone ? "Ready to start — move to in_progress" : "Waiting on dependencies";
    default:
      return "Manual review";
  }
}

function findPhaseKeyByNumber(entries, number) {
  const prefix = `phase_${number}_`;
  for (const [key] of entries) {
    if (key === `phase_${number}` || key.startsWith(prefix)) return key;
  }
  return null;
}

function checkPrStatusConsistency(ssot, entries, warnings) {
  const phaseMap = new Map(entries);

  for (const key of Object.keys(ssot)) {
    if (SKIP_KEYS.has(key) || key === "phases" || !isPrStatusKey(key)) continue;
    const phaseNumber = Number(key.replace("RC", ""));
    const phaseKey = findPhaseKeyByNumber(entries, phaseNumber);
    if (!phaseKey) {
      warnings.push(`PR status "${key}" found but no phase_${phaseNumber}_* entry in phases object`);
      continue;
    }
    const phase = phaseMap.get(phaseKey);
    const prStatus = normalizeStatus(ssot[key]);
    const phaseStatus = normalizeStatus(phase.status);
    if (prStatus && phaseStatus && prStatus !== phaseStatus) {
      warnings.push(`Inconsistency: "${key}" is "${ssot[key]}" but "${phaseKey}".status is "${phase.status}"`);
    }
  }
}

function generateReport(ssotPath) {
  const ssot = loadJson(ssotPath);
  const errors = [];
  const warnings = [];
  const report = [];

  // -- lane metadata
  const meta = ssot.phase_meta;
  const laneLabel = meta?.status ? statusLabel(meta.status) : "Unknown";
  report.push(`# Roadmap Readiness Report`);
  report.push(`Source: \`${path.relative(process.cwd(), ssotPath)}\``);
  report.push(`Lane status: ${laneLabel}`);
  if (meta?.summary) report.push(`\nGoal: ${meta.summary}`);
  if (Array.isArray(meta?.current_focus)) {
    report.push(`\nCurrent focus:`);
    for (const item of meta.current_focus) report.push(`  - ${item}`);
  }
  report.push("");

  // -- validate phases
  const entries = validatePhases(ssot, errors);

  // -- check preconditions
  checkPreconditions(ssot, entries, warnings);

  // -- check PR status consistency
  checkPrStatusConsistency(ssot, entries, warnings);

  // -- determine if all pre-phases are done
  const allPredecessorsDone = (phaseKey, entries, phaseMap) => {
    const phase = phaseMap.get(phaseKey);
    if (!phase) return true;
    const deps = phase.depends_on;
    if (!Array.isArray(deps) || deps.length === 0) return true;
    return deps.every((depKey) => {
      const dep = phaseMap.get(depKey);
      return dep && DONE_STATUSES.has(normalizeStatus(dep.status));
    });
  };

  const phaseMap = new Map(entries);

  // -- per-phase readiness
  report.push("## Per-Phase Readiness\n");
  report.push("| Phase | Title | Status | Completion | Preconditions Met | Next Action |");
  report.push("|-------|-------|--------|------------|-------------------|-------------|");

  for (const [key, phase] of entries) {
    const normalized = normalizeStatus(phase.status);
    const completion = computeCompletion(phase);
    const depsMet = allPredecessorsDone(key, entries, phaseMap);
    const action = nextAction(key, phase, depsMet);
    const numMatch = key.match(/phase_(\d+)/);
    const phaseNum = numMatch ? `RC${numMatch[1]}` : key;
    report.push(
      `| ${phaseNum} | ${phase.title} | ${statusLabel(phase.status)} | ${completion}% | ${depsMet ? "Yes" : "No — see warnings"} | ${action} |`
    );
  }

  // -- errors
  if (errors.length > 0) {
    report.push("\n## Validation Errors\n");
    for (const err of errors) report.push(`- ❌ ${err}`);
  }

  // -- warnings
  if (warnings.length > 0) {
    report.push("\n## Warnings\n");
    for (const warn of warnings) report.push(`- ⚠️  ${warn}`);
  }

  // -- recommended actions
  report.push("\n## Recommended Actions\n");
  const readyToStart = entries.filter(([key, phase]) => {
    const status = normalizeStatus(phase.status);
    return (status === "planned" || status === "not_started") && allPredecessorsDone(key, entries, phaseMap);
  });
  const phaseLabel = (key) => {
    const numMatch = key.match(/phase_(\d+)/);
    return numMatch ? `RC${numMatch[1]}` : key;
  };

  if (readyToStart.length > 0) {
    report.push("Ready to move to in_progress:");
    for (const [key, phase] of readyToStart) {
      report.push(`  - ${phaseLabel(key)} — ${phase.title}`);
    }
  }

  const blocked = entries.filter(([, phase]) => BLOCKED_STATUSES.has(normalizeStatus(phase.status)));
  if (blocked.length > 0) {
    report.push("\nBlocked phases:");
    for (const [key, phase] of blocked) {
      report.push(`  - ${phaseLabel(key)} — ${phase.title}`);
    }
  }

  const inProgress = entries.filter(([, phase]) => ACTIVE_STATUSES.has(normalizeStatus(phase.status)));
  if (inProgress.length > 0) {
    report.push("\nPhases currently in progress:");
    for (const [key, phase] of inProgress) {
      const numMatch = key.match(/phase_(\d+)/);
      const label = numMatch ? `RC${numMatch[1]}` : key;
      report.push(`  - ${label} — ${phase.title}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    report.push("\nNo validation issues found.");
  }

  report.push("");
  report.push(`Report generated: ${new Date().toISOString().replace(/\.\d{3}Z/, "00Z")}`);

  return report.join("\n");
}

// -- main
const ssotPath = path.join("docs", "roadmaps", "review-grade-evidence-intelligence", "phase-status.json");
const report = generateReport(ssotPath);
console.log(report);

// Exit with non-zero if there are errors
const ssot = loadJson(ssotPath);
const errors = [];
validatePhases(ssot, errors);
if (errors.length > 0) die("", 1);
