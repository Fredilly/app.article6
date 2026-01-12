#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const method = process.argv[2];
const version = process.argv[3];
const out = process.argv[4] || "/tmp/audit-pack.zip";

if (!method || !version) {
  console.error("Usage: node scripts/build-audit-pack.mjs <METHOD> <VERSION> [OUT_ZIP]");
  process.exit(1);
}

const require = createRequire(import.meta.url);
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS" });
require("ts-node/register");
const mod = require(path.resolve("src/exports/auditPack.ts"));
const buildAuditPackZip = mod.buildAuditPackZip || mod.default || mod.buildAuditPack;

if (typeof buildAuditPackZip !== "function") {
  console.error("Could not find buildAuditPackZip export in src/exports/auditPack.ts");
  process.exit(1);
}

const zip = await buildAuditPackZip(method, version);
fs.writeFileSync(out, zip);
console.log(out);
