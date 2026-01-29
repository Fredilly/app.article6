import fs from "node:fs";
import path from "node:path";

const TICKETS_PATH = path.join(process.cwd(), "docs", "tickets", "tickets.jsonl");

function readTickets(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseArgs(argv) {
  const out = { status: "open" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--status") out.status = argv[++i] ?? "open";
  }
  return out;
}

const { status } = parseArgs(process.argv.slice(2));
const tickets = readTickets(TICKETS_PATH).filter((ticket) => ticket.status === status);

const groups = new Map();
for (const ticket of tickets) {
  const severity = ticket.severity ?? "unknown";
  if (!groups.has(severity)) groups.set(severity, []);
  groups.get(severity).push(ticket);
}

const order = ["blocker", "high", "medium", "low", "unknown"];
const severities = Array.from(groups.keys()).sort(
  (a, b) => order.indexOf(a) - order.indexOf(b),
);

if (!tickets.length) {
  console.log(`No tickets with status="${status}".`);
  process.exit(0);
}

for (const severity of severities) {
  console.log(`\n${severity.toUpperCase()}`);
  const items = groups.get(severity) ?? [];
  items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const item of items) {
    const surface = item.surface ? ` — ${item.surface}` : "";
    console.log(`- ${item.id}${surface}`);
  }
}
