import fs from "node:fs";
import path from "node:path";

const TICKETS_PATH = path.join(process.cwd(), "docs", "tickets", "tickets.jsonl");

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function nextId(lines) {
  let max = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const match = id.match(/^DEMO-(\d+)$/);
      if (!match) continue;
      max = Math.max(max, Number(match[1]));
    } catch {
      // ignore malformed lines
    }
  }
  const next = max + 1;
  return `DEMO-${String(next).padStart(3, "0")}`;
}

function parseArgs(argv) {
  const out = {
    severity: null,
    surface: null,
    observed: null,
    expected: null,
    repro: [],
    artifact: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--severity") out.severity = argv[++i] ?? null;
    else if (arg === "--surface") out.surface = argv[++i] ?? null;
    else if (arg === "--observed") out.observed = argv[++i] ?? null;
    else if (arg === "--expected") out.expected = argv[++i] ?? null;
    else if (arg === "--repro") out.repro.push(argv[++i] ?? "");
    else if (arg === "--artifact") out.artifact.push(argv[++i] ?? "");
  }
  out.repro = out.repro.filter(Boolean);
  out.artifact = out.artifact.filter(Boolean);
  return out;
}

const args = parseArgs(process.argv.slice(2));
const missing = [
  !args.severity && "severity",
  !args.surface && "surface",
  !args.observed && "observed",
  !args.expected && "expected",
  args.repro.length === 0 && "repro",
].filter(Boolean);

if (missing.length) {
  console.error(`ticket:new missing required fields: ${missing.join(", ")}`);
  process.exit(1);
}

const lines = readLines(TICKETS_PATH);
const id = nextId(lines);
const ticket = {
  id,
  status: "open",
  created_at: new Date().toISOString(),
  severity: args.severity,
  surface: args.surface,
  observed: args.observed,
  expected: args.expected,
  repro: args.repro,
  artifacts: args.artifact,
};

fs.mkdirSync(path.dirname(TICKETS_PATH), { recursive: true });
fs.appendFileSync(TICKETS_PATH, JSON.stringify(ticket) + "\n", "utf8");
console.log(id);
