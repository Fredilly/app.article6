#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import artifacts from "../src/integrity/artifacts.js";

const { sha256Hex } = artifacts;

const BASE_URL = "http://localhost:3010";
const METHOD = "AR-ACM0003";
const VERSION = "v02-0";
const OUT_DIR = "/tmp/audit-pack-smoke";

function sh(cmd, env) {
  return execSync(cmd, { stdio: "inherit", env: env ?? process.env });
}

function shOut(cmd, env) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: env ?? process.env });
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

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond in ${timeoutMs}ms`);
}

function ensureBuild() {
  const buildDir = path.join(process.cwd(), ".next");
  if (fs.existsSync(buildDir)) return;
  console.log("Building app for smoke test...");
  sh("npm run build");
}

const url = `${BASE_URL}/api/exports/audit-pack?method=${encodeURIComponent(METHOD)}&version=${encodeURIComponent(VERSION)}`;

ensureDir(OUT_DIR);

const run1 = path.join(OUT_DIR, "run1.zip");
const run2 = path.join(OUT_DIR, "run2.zip");
const tamperDir = path.join(OUT_DIR, "tamper");
const tamperZip = path.join(OUT_DIR, "tampered.zip");

let server;
let serverStarted = false;
try {
  ensureBuild();

  try {
    await waitForServer(`${BASE_URL}/api/health`, 2000);
    console.log("Reusing existing server on http://localhost:3010 ...");
  } catch {
    console.log("Starting server on http://localhost:3010 ...");
    server = spawn("npm", ["run", "start", "--", "-p", "3010"], {
      stdio: "inherit",
      env: process.env,
    });
    serverStarted = true;
    await waitForServer(`${BASE_URL}/api/health`);
  }

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
function findFirstJson(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFirstJson(full);
      if (found) return found;
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      return full;
    }
  }
  return "";
}

const jsonFile = findFirstJson(tamperDir);
if (!jsonFile) {
  die("❌ No JSON files found to tamper.");
}

const text = fs.readFileSync(jsonFile, "utf8");
fs.writeFileSync(jsonFile, `${text}\n"_tamper":true\n`, "utf8");
console.log(`tampered: ${jsonFile}`);

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
} finally {
  if (server && serverStarted) {
    server.kill("SIGTERM");
  }
}
