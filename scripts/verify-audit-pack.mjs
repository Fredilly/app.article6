#!/usr/bin/env node
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const zip = process.argv[2] || "/tmp/audit-pack.zip";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function shBuf(cmd) {
  return execSync(cmd, { encoding: null, stdio: ["ignore", "pipe", "pipe"] });
}

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

function zipListFiles(zipPath) {
  const out = sh(`unzip -Z1 "${zipPath}"`);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !p.endsWith("/"));
}

function zipReadText(zipPath, p) {
  return sh(`unzip -p "${zipPath}" "${p}"`);
}
function zipReadBuf(zipPath, p) {
  return shBuf(`unzip -p "${zipPath}" "${p}"`);
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

try {
  const manifestRaw = zipReadText(zip, "manifest.json");
  const manifest = JSON.parse(manifestRaw);

  if (!manifest?.files || !Array.isArray(manifest.files)) {
    die("❌ manifest.json missing .files[]");
  }

  const zipFiles = zipListFiles(zip);
  const zipSet = new Set(zipFiles);

  const manifestPaths = manifest.files.map((f) => f.path);
  const allowed = new Set(["manifest.json", ...manifestPaths]);

  const extras = zipFiles.filter((p) => !allowed.has(p));
  const missing = manifestPaths.filter((p) => !zipSet.has(p));

  if (extras.length) {
    console.error("❌ EXTRA files not in manifest.json:");
    for (const p of extras) console.error("  -", p);
  }
  if (missing.length) {
    console.error("❌ MISSING files listed in manifest.json but not in zip:");
    for (const p of missing) console.error("  -", p);
  }
  if (extras.length || missing.length) process.exit(1);

  let ok = 0;
  let fail = 0;
  for (const f of manifest.files) {
    const p = f.path;
    const isJson = p.toLowerCase().endsWith(".json");

    let bytes;
    if (isJson) {
      const raw = zipReadText(zip, p);
      const parsed = JSON.parse(raw);
      bytes = Buffer.from(canonicalStringify(parsed), "utf8");
    } else {
      bytes = Buffer.from(zipReadBuf(zip, p));
    }

    const h = sha256Hex(bytes);
    if (h !== f.sha256) {
      console.error(`❌ HASH MISMATCH ${p}\n  expected ${f.sha256}\n  got      ${h}`);
      fail++;
    } else {
      ok++;
    }
  }

  if (fail) {
    console.error(`FAIL ok=${ok} fail=${fail}`);
    process.exit(1);
  }

  console.log(`✅ PASS ok=${ok} fail=${fail} (strict inventory + sha256)`);
} catch (e) {
  console.error("❌ verify-audit-pack failed:", e?.message || e);
  process.exit(1);
}
