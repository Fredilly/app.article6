#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import artifacts from "../src/integrity/artifacts.js";

const { sha256Hex } = artifacts;

const BASE_URL = "http://localhost:3012";
const METHOD = "AR-ACM0003";
const VERSION = "v02-0";
const OUT_DIR = "/tmp/audit-pack-trail-smoke";
const HARD_TIMEOUT_MS = 2 * 60 * 1000;

function sh(cmd, env) {
  return execSync(cmd, { stdio: "inherit", env: env ?? process.env });
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

async function waitForServer(url, timeoutMs = 30000) {
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

const url = `${BASE_URL}/api/exports/audit-pack?method=${encodeURIComponent(METHOD)}&version=${encodeURIComponent(VERSION)}`;

ensureDir(OUT_DIR);

const run1 = path.join(OUT_DIR, "run1.zip");
const tamperDir = path.join(OUT_DIR, "tamper");
const tamperZip = path.join(OUT_DIR, "tampered.zip");
const missingZip = path.join(OUT_DIR, "missing-trail.zip");

let server;
let smokeSucceeded = false;
let hardTimeout;

try {
  hardTimeout = setTimeout(() => {
    console.error(`❌ Smoke test timed out after ${HARD_TIMEOUT_MS}ms`);
    process.exit(1);
  }, HARD_TIMEOUT_MS);

  console.log("Starting server on http://localhost:3012 ...");
  server = spawn("npm", ["run", "start", "--", "-p", "3012"], {
    detached: true,
    stdio: "inherit",
    env: process.env,
  });

  await waitForServer(`${BASE_URL}/api/health`);

  console.log(`Fetching audit-pack from ${url}`);
  sh(`curl -LfsS "${url}" -o "${run1}"`);

  const hash1 = sha256Hex(fs.readFileSync(run1));
  console.log(`✅ Downloaded audit-pack sha256=${hash1}`);

  console.log("Verifying zip...");
  sh(`npm run verify:audit-pack -- "${run1}"`);

  console.log("Tampering with trail.jsonl...");
  cleanDir(tamperDir);
  sh(`unzip -q "${run1}" -d "${tamperDir}"`);

  const trailPath = path.join(tamperDir, "trail.jsonl");
  if (!fs.existsSync(trailPath)) {
    die("❌ trail.jsonl missing after unzip.");
  }
  const text = fs.readFileSync(trailPath, "utf8");
  fs.writeFileSync(trailPath, `${text}{"oops":true}\n`, "utf8");

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

  console.log("Removing trail.jsonl...");
  cleanDir(tamperDir);
  sh(`unzip -q "${run1}" -d "${tamperDir}"`);
  fs.rmSync(path.join(tamperDir, "trail.jsonl"), { force: true });
  sh(`cd "${tamperDir}" && zip -qr "${missingZip}" .`);

  console.log("Verifying missing-trail zip (should fail)...");
  let missingOk = true;
  try {
    sh(`npm run verify:audit-pack -- "${missingZip}"`);
  } catch {
    missingOk = false;
  }
  if (missingOk) {
    die("❌ Missing trail zip unexpectedly passed verification.");
  }

  console.log("✅ PASS: trail verification + tamper fail");
  smokeSucceeded = true;
} finally {
  if (hardTimeout) clearTimeout(hardTimeout);
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {}
  }
}

process.exit(smokeSucceeded ? 0 : 1);
