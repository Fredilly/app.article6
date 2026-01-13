#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import artifacts from "../src/integrity/artifacts.js";

const { sha256Hex } = artifacts;

const method = process.argv[2] || "AR-ACM0003";
const version = process.argv[3] || "v02-0";

const a = "/tmp/audit-pack.A.zip";
const b = "/tmp/audit-pack.B.zip";

const env = {
  ...process.env,
  SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || "0",
};

execSync(`node scripts/build-audit-pack.mjs ${method} ${version} ${a}`, { stdio: "inherit", env });
execSync(`node scripts/build-audit-pack.mjs ${method} ${version} ${b}`, { stdio: "inherit", env });

const sha = (p) => sha256Hex(fs.readFileSync(p));
const ha = sha(a);
const hb = sha(b);

if (ha !== hb) {
  console.error("❌ NOT IDENTICAL");
  console.error("A", ha, a);
  console.error("B", hb, b);
  process.exit(1);
}

console.log("✅ IDENTICAL", ha);
