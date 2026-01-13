#!/usr/bin/env node
import { execSync } from "node:child_process";
import artifacts from "../src/integrity/artifacts.js";

const { canonicalStringify, sha256Hex } = artifacts;

const zip = process.argv[2] || "/tmp/audit-pack.zip";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function shBuf(cmd) {
  return execSync(cmd, { encoding: null, stdio: ["ignore", "pipe", "pipe"] });
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

function assertTraceShape(trace) {
  if (!trace || typeof trace !== "object") throw new Error("trace.json must be an object");
  if (trace.version !== 1) throw new Error("trace.json missing version=1");
  if (!trace.method || typeof trace.method !== "object") throw new Error("trace.json missing method");
  if (typeof trace.method.code !== "string" || typeof trace.method.version !== "string") {
    throw new Error("trace.json method must include code and version");
  }
  if (!trace.rule_to_sections || typeof trace.rule_to_sections !== "object") {
    throw new Error("trace.json missing rule_to_sections");
  }
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
      if (p === "trace.json") {
        try {
          assertTraceShape(parsed);
        } catch (error) {
          console.error(`❌ INVALID TRACE ${p}\n  ${error?.message || error}`);
          fail++;
          continue;
        }
      }
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
