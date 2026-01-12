#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const METHOD = process.env.METHOD || "AR-ACM0003";
const VERSION = process.env.VERSION || "v02-0";
const OUT_DIR = process.env.OUT_DIR || "/tmp/audit-pack-smoke";

function sh(cmd, env) {
  return execSync(cmd, { stdio: "inherit", env: env ?? process.env });
}

function shOut(cmd, env) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: env ?? process.env });
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

const url = `${BASE_URL}/api/exports/audit-pack?method=${encodeURIComponent(METHOD)}&version=${encodeURIComponent(VERSION)}`;

ensureDir(OUT_DIR);

const run1 = path.join(OUT_DIR, "run1.zip");
const run2 = path.join(OUT_DIR, "run2.zip");
const tamperDir = path.join(OUT_DIR, "tamper");
const tamperZip = path.join(OUT_DIR, "tampered.zip");

console.log(`Fetching audit-pack twice from ${url}`);
sh(`curl -LfsS "${url}" -o "${run1}"`);
sh(`curl -LfsS "${url}" -o "${run2}"`);

const hash1 = sha256Hex(fs.readFileSync(run1));
const hash2 = sha256Hex(fs.readFileSync(run2));

if (hash1 !== hash2) {
  die(`❌ Byte mismatch: ${hash1} vs ${hash2}`);
}
console.log(`✅ Deterministic bytes: ${hash1}`);

console.log("Verifying both zips...");
sh(`npm run verify:audit-pack -- "${run1}"`);
sh(`npm run verify:audit-pack -- "${run2}"`);

console.log("Tampering with a JSON file...");
cleanDir(tamperDir);
sh(`unzip -q "${run1}" -d "${tamperDir}"`);
const jsonFiles = shOut(`python - <<'PY'\nfrom pathlib import Path\nfiles = list(Path("${tamperDir}").rglob("*.json"))\nif not files:\n  print(\"\", end=\"\")\nelse:\n  print(str(files[0]))\nPY`).trim();

if (!jsonFiles) {
  die("❌ No JSON files found to tamper.");
}

sh(`python - <<'PY'\nfrom pathlib import Path\np = Path("${jsonFiles}")\ntext = p.read_text()\np.write_text(text + \"\\n\\\"_tamper\\\":true\\n\")\nprint(f\"tampered: {p}\")\nPY`);

sh(`cd "${tamperDir}" && zip -qr "${tamperZip}" .`);

console.log("Verifying tampered zip (should fail)...");
let tamperOk = true;
try {
  sh(`npm run verify:audit-pack -- "${tamperZip}"`);
} catch {
  tamperOk = false;
}

if (tamperOk) {
  die("❌ Tampered zip unexpectedly passed verification.");
}

console.log("✅ PASS: determinism + verification + tamper fail");
