import fs from "node:fs";
import path from "node:path";

const STATUS_LABELS = {
  planned: "Planned",
  next: "Next",
  "in-progress": "In progress",
  done: "Done",
  blocked: "Blocked",
  merged: "Done",
};

export function normalizeStatus(value) {
  if (!value) return null;
  const lowered = String(value).trim().toLowerCase();
  if (["in_progress", "in-progress", "in progress"].includes(lowered)) return "in-progress";
  if (["done", "complete", "completed"].includes(lowered)) return "done";
  if (["planned"].includes(lowered)) return "planned";
  if (["next"].includes(lowered)) return "next";
  if (["blocked"].includes(lowered)) return "blocked";
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
    const match = line.match(/^##\s+(PR\d+)\s*(?:[-—:]\s*)?(.*)$/i);
    if (!match) continue;
    const id = match[1].toUpperCase();
    const title = match[2]?.trim() || null;
    items.push({ id, title });
  }
  return items;
}

export function findPlanPath(docsRoot, slug) {
  const projectPlan = path.join(docsRoot, "projects", slug, "PLAN.md");
  if (fs.existsSync(projectPlan)) return projectPlan;
  const roadmapPlan = path.join(docsRoot, "roadmaps", slug, "PLAN.md");
  if (fs.existsSync(roadmapPlan)) return roadmapPlan;
  return null;
}

export function listSsotFiles(ssotRoot) {
  if (!fs.existsSync(ssotRoot)) return [];
  return listFiles(ssotRoot, (file) => file.endsWith("phase-status.json"));
}

export function generateRoadmapContent(ssotRoot, docsRoot) {
  const ssotFiles = listSsotFiles(ssotRoot).sort();
  const sections = [];

  for (const ssotPath of ssotFiles) {
    const slug = path.basename(path.dirname(ssotPath));
    const ssot = JSON.parse(fs.readFileSync(ssotPath, "utf8"));
    const planPath = findPlanPath(docsRoot, slug);
    const planItems = parsePlanTitles(planPath);
    const planOrder = planItems.map((item) => item.id);

    const ssotItems = Object.entries(ssot)
      .filter(([key]) => /^PR\d+$/i.test(key))
      .map(([key, value]) => ({ id: key.toUpperCase(), status: normalizeStatus(value) }))
      .sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2)));

    const ordered = [
      ...planOrder.map((id) => ssotItems.find((item) => item.id === id)).filter(Boolean),
      ...ssotItems.filter((item) => !planOrder.includes(item.id)),
    ];

    const items = ordered.map((item, idx) => {
      const title = planItems.find((entry) => entry.id === item.id)?.title;
      const label = statusLabel(item.status);
      const titlePart = title ? ` — ${title}` : "";
      return `${idx + 1}) ${item.id}${titlePart}: ${label}`;
    });

    const sectionLines = [
      `## ${slug}`,
      "",
      `Status SSOT: \`${ssotPath}\``,
      planPath ? `Details: \`${planPath}\`` : null,
      "",
      ...items,
      "",
    ].filter((line) => line !== null);

    sections.push(sectionLines.join("\n"));
  }

  return [
    "# Projects Roadmap",
    "",
    "This file is generated from roadmap SSOT JSON. Do not edit manually.",
    "",
    ...sections,
  ].join("\n");
}

export function parseRoadmapDirective(body) {
  if (!body) return null;
  const lines = String(body).split("\n");
  const startIdx = lines.findIndex((line) => /^###\s+Roadmap-Update\b/i.test(line));
  if (startIdx === -1) return null;
  const directiveLines = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^###\s+/i.test(line)) break;
    directiveLines.push(line);
  }

  let slug = null;
  const items = [];
  for (const rawLine of directiveLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const slugMatch = line.match(/^\-?\s*slug:\s*(.+)$/i);
    if (slugMatch) {
      slug = slugMatch[1].trim();
      continue;
    }
    const itemMatch = line.match(/^\-?\s*(PR\d+)\s*:\s*([a-zA-Z_-]+)\s*$/i);
    if (itemMatch) {
      items.push({ id: itemMatch[1].toUpperCase(), status: itemMatch[2].trim() });
    }
  }

  return { slug, items };
}
