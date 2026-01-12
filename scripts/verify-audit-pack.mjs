import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const zipPath = process.argv[2] || "/tmp/audit-pack.zip";

function canonicalStringify(value) {
  const seen = new WeakSet();
  const norm = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(norm);
    if (seen.has(v)) throw new Error("circular");
    seen.add(v);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  };
  return JSON.stringify(norm(value)) + "\n";
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function unzipText(entryPath) {
  return execFileSync("unzip", ["-p", zipPath, entryPath], { encoding: "utf8" });
}

function unzipBuffer(entryPath) {
  return execFileSync("unzip", ["-p", zipPath, entryPath]);
}

function isJsonPath(p) {
  return p.toLowerCase().endsWith(".json");
}

let manifestRaw;
try {
  manifestRaw = unzipText("manifest.json");
} catch (error) {
  console.error(`Failed to read manifest.json from ${zipPath}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (error) {
  console.error("manifest.json is not valid JSON.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.files)) {
  console.error("manifest.json missing files[] array.");
  process.exit(1);
}

let ok = 0;
let fail = 0;
for (const entry of manifest.files) {
  if (!entry || typeof entry !== "object") continue;
  const path = entry.path;
  const expected = entry.sha256;
  if (typeof path !== "string" || typeof expected !== "string") continue;

  try {
    const raw = unzipBuffer(path);
    const actual = (() => {
      if (!isJsonPath(path)) return sha256Hex(raw);
      const parsed = JSON.parse(raw.toString("utf8"));
      const canonical = Buffer.from(canonicalStringify(parsed), "utf8");
      return sha256Hex(canonical);
    })();

    if (actual !== expected) {
      console.error(`❌ ${path}`);
      console.error(`  expected ${expected}`);
      console.error(`  got      ${actual}`);
      fail += 1;
    } else {
      ok += 1;
    }
  } catch (error) {
    console.error(`❌ ${path}`);
    console.error(error instanceof Error ? error.message : String(error));
    fail += 1;
  }
}

if (fail) {
  console.error(`FAIL ok=${ok} fail=${fail}`);
  process.exit(1);
}
console.log(`PASS ok=${ok} fail=${fail}`);
