import fs from "node:fs";

function read(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stableSort(a) {
  return a.sort((x, y) => x.localeCompare(y));
}

function index(manifest) {
  // Expect: { files: [{ path, sha256, ... }] } OR { "<path>": "<sha>" } — handle both
  if (Array.isArray(manifest?.files)) {
    const m = new Map();
    for (const f of manifest.files) {
      if (f?.path && f?.sha256) m.set(f.path, f.sha256);
    }
    return m;
  }
  const m = new Map();
  for (const [k, v] of Object.entries(manifest ?? {})) {
    if (typeof v === "string") m.set(k, v);
    if (v && typeof v === "object" && typeof v.sha256 === "string") {
      m.set(k, v.sha256);
    }
  }
  return m;
}

const aPath = process.argv[2];
const bPath = process.argv[3];
const outPath = process.argv[4] ?? null;

if (!aPath || !bPath) {
  console.error(
    "Usage: node scripts/audit-pack/diff-manifests.mjs <manifestA.json> <manifestB.json> [out.json]"
  );
  process.exit(2);
}

const A = index(read(aPath));
const B = index(read(bPath));

const added = [];
const removed = [];
const changed = [];

for (const k of A.keys()) if (!B.has(k)) removed.push(k);
for (const k of B.keys()) if (!A.has(k)) added.push(k);
for (const k of A.keys()) if (B.has(k) && A.get(k) !== B.get(k)) changed.push(k);

stableSort(added);
stableSort(removed);
stableSort(changed);

const diff = {
  version: 1,
  a: aPath,
  b: bPath,
  counts: { added: added.length, removed: removed.length, changed: changed.length },
  added,
  removed,
  changed,
};

if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(diff, null, 2) + "\n");
} else {
  console.log(JSON.stringify(diff, null, 2));
}
