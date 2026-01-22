import fs from "node:fs";
import path from "node:path";

function nowIso() {
  return new Date().toISOString();
}

function safeBranchName(s) {
  return String(s ?? "unknown").replace(/[^\w.-]+/g, "-");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function append(file, text) {
  fs.appendFileSync(file, text);
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const mode = process.argv[2]; // start|end|append
const repo = process.env.CODEX_REPO ?? "";
const branch = safeBranchName(process.env.CODEX_BRANCH ?? "");
const pr = process.env.CODEX_PR_URL ?? "";

const date = nowIso().slice(0, 10);
const logDir = path.join("docs", "ops", "codex-runs");
ensureDir(logDir);

const file = path.join(logDir, `${date}_${branch || "unknown"}.md`);

if (mode === "start") {
  const header =
`# Codex run log

- repo: ${repo || "(unknown)"}
- branch: ${branch || "(unknown)"}
- started_at: ${nowIso()}

## Notes
`;
  fs.writeFileSync(file, header);
  console.log(file);
  process.exit(0);
}

if (mode === "append") {
  const body = readStdin();
  if (body.trim()) append(file, `\n${body.trim()}\n`);
  console.log(file);
  process.exit(0);
}

if (mode === "end") {
  const status = process.env.CODEX_STATUS ?? "";
  const ci = process.env.CODEX_CI ?? "";
  const footer =
`\n## Outcome
- finished_at: ${nowIso()}
- status: ${status || "(unknown)"}
- npm run ci: ${ci || "(unknown)"}
- PR: ${pr || "(none)"}
`;
  append(file, footer);
  console.log(file);
  process.exit(0);
}

console.error("Usage: node scripts/ops/codex-run-log.mjs <start|append|end>");
process.exit(2);
