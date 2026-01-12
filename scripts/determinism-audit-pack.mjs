#!/usr/bin/env node
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";

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

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const ha = sha(a);
const hb = sha(b);

if (ha !== hb) {
  console.error("❌ NOT IDENTICAL");
  console.error("A", ha, a);
  console.error("B", hb, b);
  process.exit(1);
}

console.log("✅ IDENTICAL", ha);
