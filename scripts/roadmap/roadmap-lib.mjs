import fs from "node:fs";
import path from "node:path";

function toRepoRelPath(filePath) {
  if (!filePath) return null;
  const rel = path.relative(process.cwd(), filePath);
  // Normalize for markdown + cross-platform output
  return rel.split(path.sep).join("/");
}

const STATUS_LABELS = {
  planned: "Planned",
  next: "Next",
  active: "Active",
  "in-progress": "In progress",
  done: "Done",
  blocked: "Blocked",
  deferred: "Deferred",
  frozen: "Frozen",
  parked: "Parked",
  merged: "Done",
};

export function normalizePrId(value) {
  const match = String(value ?? "").trim().toUpperCase().match(/^PR(\d+)(?:[._](\d+))?$/);
  if (!match) return null;
  const main = match[1];
  const sub = match[2] ?? null;
  return sub ? `PR${main}_${sub}` : `PR${main}`;
}

export function formatPrId(value) {
  const normalized = normalizePrId(value);
  if (!normalized) return String(value ?? "");
  return normalized.replace("_", ".");
}

export function prSortKey(value) {
  const normalized = normalizePrId(value);
  if (!normalized) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
  const [, main, sub] = normalized.match(/^PR(\d+)(?:_(\d+))?$/) ?? [];
  return [Number(main ?? Number.MAX_SAFE_INTEGER), Number(sub ?? 0)];
}

export function normalizeStatus(value) {
  if (!value) return null;
  const lowered = String(value).trim().toLowerCase();
  if (["in_progress", "in-progress", "in progress"].includes(lowered)) return "in-progress";
  if (["done", "complete", "completed"].includes(lowered)) return "done";
  if (["planned"].includes(lowered)) return "planned";
  if (["next"].includes(lowered)) return "next";
  if (["active"].includes(lowered)) return "active";
  if (["blocked"].includes(lowered)) return "blocked";
  if (["deferred"].includes(lowered)) return "deferred";
  if (["frozen"].includes(lowered)) return "frozen";
  if (["parked"].includes(lowered)) return "parked";
  if (["merged"].includes(lowered)) return "merged";
  return lowered;
}

export function statusLabel(value) {
  if (!value) return "Unknown";
  const normalized = normalizeStatus(value);
  return STATUS_LABELS[normalized] ?? "Unknown";
}

function listFiles(root, matcher) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (matcher(current)) out.push(current);
  }
  return out;
}

export function parsePlanTitles(planPath) {
  if (!planPath || !fs.existsSync(planPath)) return [];
  const lines = fs.readFileSync(planPath, "utf8").split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/^##\s+(PR\d+(?:[._]\d+)?)\s*(?:[-—:]\s*)?(.*)$/i);
    if (!match) continue;
    const id = normalizePrId(match[1]);
    if (!id) continue;
    const title = match[2]?.trim() || null;
    items.push({ id, title });
  }
  return items;
}

export function findPlanPath(docsRoot, slug) {
  const roadmapPlan = path.join(docsRoot, "roadmaps", slug, "PLAN.md");
  if (fs.existsSync(roadmapPlan)) return roadmapPlan;
  return null;
}

export function listSsotFiles(ssotRoot) {
  if (!fs.existsSync(ssotRoot)) return [];
  return listFiles(ssotRoot, (file) => file.endsWith("phase-status.json"));
}

function minPrNumber(ssot) {
  if (!ssot) return Infinity;
  let min = Infinity;
  for (const key of Object.keys(ssot)) {
    const id = normalizePrId(key);
    if (!id) continue;
    const [main] = prSortKey(id);
    if (main < min) min = main;
  }
  return min;
}

export function generateRoadmapContent(ssotRoot, docsRoot) {
  const ssotFiles = listSsotFiles(ssotRoot);
  const sections = [];
  const PARENT = { "verification-factory": "verifier-moat" };

  const sectionData = ssotFiles.map((ssotPath) => {
    const slug = path.basename(path.dirname(ssotPath));
    const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
    const evidence = ssot.pr_evidence ?? {};
    const phaseMeta = ssot.phase_meta ?? {};
    const prNotes = ssot.pr_notes ?? {};
    const planPath = findPlanPath(docsRoot, slug);
    const planItems = parsePlanTitles(planPath);
    const planOrder = planItems.map((item) => item.id);

    const ssotItems = Object.entries(ssot)
      .map(([key, value]) => ({ id: normalizePrId(key), status: normalizeStatus(value) }))
      .filter((item) => item.id)
      .map((item) => ({ id: item.id, status: item.status }))
      .sort((a, b) => {
        const [aMain, aSub] = prSortKey(a.id);
        const [bMain, bSub] = prSortKey(b.id);
        if (aMain !== bMain) return aMain - bMain;
        return aSub - bSub;
      });

    const ordered = [
      ...planOrder.map((id) => ssotItems.find((item) => item.id === id)).filter(Boolean),
      ...ssotItems.filter((item) => !planOrder.includes(item.id)),
    ];

    const items = ordered.map((item, idx) => {
      const title = planItems.find((entry) => entry.id === item.id)?.title;
      const label = statusLabel(item.status);
      const hasReceipts =
        (item.status === "done" || item.status === "merged") && Array.isArray(evidence[item.id]);
      const receipts = hasReceipts ? evidence[item.id] : null;
      const receiptText = receipts && receipts.length ? ` (PR #${receipts.join(", #")})` : "";
      const titlePart = title ? ` — ${title}` : "";
      const note = prNotes[item.id]?.reason ? ` — ${prNotes[item.id].reason}` : "";
      return `${idx + 1}) ${formatPrId(item.id)}${titlePart}: ${label}${receiptText}${note}`;
    });

    return {
      slug,
      ssotPath,
      planPath,
      items,
      minPr: minPrNumber(ssot),
      phaseMeta,
    };
  });

  const sortedSections = sectionData.sort((a, b) => {
    if (a.minPr !== b.minPr) return a.minPr - b.minPr;
    return a.slug.localeCompare(b.slug);
  });

  const sectionsBySlug = new Map(sortedSections.map((section) => [section.slug, section]));
  const childrenByParent = new Map();
  for (const section of sortedSections) {
    const parent = PARENT[section.slug];
    if (!parent || !sectionsBySlug.has(parent)) continue;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(section);
  }

  const renderSection = (section, headingLevel) => {
    const heading = `${"#".repeat(headingLevel)} ${section.slug}`;
    const laneStatus = section.phaseMeta.status ? `Lane status: ${statusLabel(section.phaseMeta.status)}` : null;
    const summary = section.phaseMeta.summary ? `${section.phaseMeta.summary}` : null;
    const currentFocus = Array.isArray(section.phaseMeta.current_focus) ? section.phaseMeta.current_focus : [];
    const notActiveNow = Array.isArray(section.phaseMeta.not_active_now) ? section.phaseMeta.not_active_now : [];
    const renderBullets = (title, items) =>
      items.length ? [title, ...items.map((item) => `- ${item}`), ""] : [];
    const sectionLines = [
      heading,
      "",
      `Status SSOT: \`${toRepoRelPath(section.ssotPath)}\``,
      section.planPath ? `Details: \`${toRepoRelPath(section.planPath)}\`` : null,
      "",
      laneStatus,
      summary,
      ...(laneStatus || summary ? [""] : []),
      ...renderBullets("Current focus:", currentFocus),
      ...renderBullets("Not active now:", notActiveNow),
      ...section.items,
      "",
    ].filter((line) => line !== null);
    return sectionLines.join("\n");
  };

  const activeLanes = sortedSections
    .filter((section) => normalizeStatus(section.phaseMeta.status) === "active")
    .map((section) => section.slug);
  const frozenLanes = sortedSections
    .filter((section) => normalizeStatus(section.phaseMeta.status) === "frozen")
    .map((section) => section.slug);
  const deferredItems = sortedSections.flatMap((section) =>
    Object.entries(section.phaseMeta.deferred_items ?? {}).map(([pr, reason]) => ({
      pr,
      reason,
      slug: section.slug,
    })),
  );

  for (const section of sortedSections) {
    const parent = PARENT[section.slug];
    if (parent && sectionsBySlug.has(parent)) continue;
    sections.push(renderSection(section, 2));
    const children = childrenByParent.get(section.slug) ?? [];
    for (const child of children) {
      sections.push(renderSection(child, 3));
    }
  }

  return [
    "# Roadmaps Summary",
    "",
    "This file is generated from roadmap SSOT JSON. Do not edit manually.",
    "",
    "Roadmap reset: only explicitly active items drive what's next; historical PR numbers stay preserved for context.",
    activeLanes.length ? `Active lanes: ${activeLanes.join(", ")}.` : null,
    frozenLanes.length ? `Frozen lanes: ${frozenLanes.join(", ")}.` : null,
    deferredItems.length
      ? `Deferred items: ${deferredItems.map((item) => `${item.slug}/${item.pr}`).join(", ")}.`
      : null,
    "",
    ...sections,
  ].join("\n");
}

export function parseRoadmapDirective(body) {
  if (!body) return null;
  const normalized = String(body).replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const startIdx = lines.findIndex((line) => /^\s*###\s+Roadmap-Update\b/i.test(line));
  if (startIdx === -1) return null;
  const directiveLines = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*###\s+/i.test(line)) break;
    directiveLines.push(line);
  }

  let slug = null;
  let ack = null;
  const items = [];
  for (const rawLine of directiveLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const slugMatch = line.match(/^\-?\s*slug:\s*(.+)$/i);
    if (slugMatch) {
      slug = slugMatch[1].trim();
      continue;
    }
    const ackMatch = line.match(/^\-?\s*ack:\s*(.+)$/i);
    if (ackMatch) {
      ack = ackMatch[1].trim();
      continue;
    }
    const itemMatch = line.match(/^\-?\s*(PR\d+(?:[._]\d+)?)\s*:\s*([a-zA-Z_-]+)\s*$/i);
    if (itemMatch) {
      const id = normalizePrId(itemMatch[1]);
      if (!id) continue;
      items.push({ id, status: itemMatch[2].trim() });
    }
  }

  return { slug, items, ack };
}
