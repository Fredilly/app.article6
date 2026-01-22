#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import JSZip from "jszip";
import artifacts from "../src/integrity/artifacts.js";

const { sha256Hex } = artifacts;

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

function assertRuleEvidenceMap(map) {
  if (!map || typeof map !== "object") throw new Error("rule_evidence_map.json must be an object");
  if (map.schema_version !== "v1") throw new Error("rule_evidence_map.json missing schema_version=v1");
  if (!map.method || typeof map.method !== "object") throw new Error("rule_evidence_map.json missing method");
  if (typeof map.method.code !== "string" || typeof map.method.version !== "string") {
    throw new Error("rule_evidence_map.json method must include code and version");
  }
  if (!Array.isArray(map.items)) throw new Error("rule_evidence_map.json items must be an array");
  if (!map.items.length && typeof map.unmapped_reason !== "string") {
    throw new Error("rule_evidence_map.json missing unmapped_reason when items empty");
  }
  for (const item of map.items) {
    if (!item || typeof item !== "object") throw new Error("rule_evidence_map.json item must be object");
    if (typeof item.evidence_id !== "string") throw new Error("rule_evidence_map.json item missing evidence_id");
    if (typeof item.evidence_type !== "string") throw new Error("rule_evidence_map.json item missing evidence_type");
    if (typeof item.source_ref !== "string") throw new Error("rule_evidence_map.json item missing source_ref");
    if (!Array.isArray(item.rule_ids)) throw new Error("rule_evidence_map.json item missing rule_ids array");
    if (!Array.isArray(item.section_anchors)) throw new Error("rule_evidence_map.json item missing section_anchors array");
    if (typeof item.justification !== "string") throw new Error("rule_evidence_map.json item missing justification");
    if (!item.rule_ids.every((id) => typeof id === "string")) {
      throw new Error("rule_evidence_map.json item rule_ids must be strings");
    }
    if (!item.section_anchors.every((id) => typeof id === "string")) {
      throw new Error("rule_evidence_map.json item section_anchors must be strings");
    }
  }
}

function assertReviewLog(log) {
  if (!log || typeof log !== "object") throw new Error("review_log.json must be an object");
  if (log.schema_version !== "v1") throw new Error("review_log.json missing schema_version=v1");
  if (!log.method || typeof log.method !== "object") throw new Error("review_log.json missing method");
  if (typeof log.method.code !== "string" || typeof log.method.version !== "string") {
    throw new Error("review_log.json method must include code and version");
  }
  if (!Array.isArray(log.entries)) throw new Error("review_log.json entries must be an array");
  for (const entry of log.entries) {
    if (!entry || typeof entry !== "object") throw new Error("review_log.json entry must be object");
    if (typeof entry.id !== "string") throw new Error("review_log.json entry missing id");
    if (typeof entry.ts !== "string") throw new Error("review_log.json entry missing ts");
    if (typeof entry.actor !== "string") throw new Error("review_log.json entry missing actor");
    if (typeof entry.action !== "string") throw new Error("review_log.json entry missing action");
    if (typeof entry.note !== "string") throw new Error("review_log.json entry missing note");
  }
}

function parseJsonLines(text, filename) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const entries = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${filename} line ${idx + 1} is not valid JSON`);
    }
  }
  return entries;
}

function assertTrailEntry(entry, filename, index) {
  if (!entry || typeof entry !== "object") throw new Error(`${filename} line ${index} must be object`);
  if (typeof entry.ts !== "string") throw new Error(`${filename} line ${index} missing ts`);
  const parsed = Date.parse(entry.ts);
  if (!Number.isFinite(parsed)) throw new Error(`${filename} line ${index} ts not ISO date`);
  if (typeof entry.actor !== "string") throw new Error(`${filename} line ${index} missing actor`);
  if (typeof entry.action !== "string") throw new Error(`${filename} line ${index} missing action`);
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
  if (!manifestPaths.includes("trail.jsonl")) {
    die("❌ manifest.json missing trail.jsonl entry");
  }
  if (!zipSet.has("trail.jsonl")) {
    die("❌ trail.jsonl missing from zip");
  }

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
    const bytes = Buffer.from(zipReadBuf(zip, p));
    if (p === "trace.json") {
      try {
        const parsed = JSON.parse(bytes.toString("utf8"));
        assertTraceShape(parsed);
      } catch (error) {
        console.error(`❌ INVALID TRACE ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }

    if (p === "evidence/rule_evidence_map.json") {
      try {
        assertRuleEvidenceMap(JSON.parse(bytes.toString("utf8")));
      } catch (error) {
        console.error(`❌ INVALID RULE EVIDENCE MAP ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }
    if (p === "evidence/review_log.json") {
      try {
        assertReviewLog(JSON.parse(bytes.toString("utf8")));
      } catch (error) {
        console.error(`❌ INVALID REVIEW LOG ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }
    if (p === "trail.jsonl") {
      try {
        const entries = parseJsonLines(bytes.toString("utf8"), p);
        for (let i = 0; i < entries.length; i += 1) {
          assertTrailEntry(entries[i], p, i + 1);
        }
      } catch (error) {
        console.error(`❌ INVALID TRAIL ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
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

  if (zipSet.has("bundle.json")) {
    const bundleRaw = zipReadText(zip, "bundle.json");
    const bundle = JSON.parse(bundleRaw);
    const integrity = bundle?.integrity || {};
    if (integrity.manifest_sha256) {
      const manifestBytes = Buffer.from(zipReadBuf(zip, "manifest.json"));
      const manifestSha = sha256Hex(manifestBytes);
      if (manifestSha !== integrity.manifest_sha256) {
        die(`❌ manifest_sha256 mismatch (expected ${integrity.manifest_sha256}, got ${manifestSha})`);
      }
    }
    if (integrity.runs_sha256) {
      const runsBytes = Buffer.from(zipReadBuf(zip, "runs.json"));
      const runsSha = sha256Hex(runsBytes);
      if (runsSha !== integrity.runs_sha256) {
        die(`❌ runs_sha256 mismatch (expected ${integrity.runs_sha256}, got ${runsSha})`);
      }
    }
    if (integrity.zip_sha256) {
      const zipBytes = fs.readFileSync(zip);
      const jszip = await JSZip.loadAsync(zipBytes);
      const payloadEntries = Object.keys(jszip.files)
        .filter((p) => !jszip.files[p].dir)
        .filter((p) => p !== "bundle.json" && p !== "manifest.json")
        .sort();
      const payloadZip = new JSZip();
      for (const p of payloadEntries) {
        const bytes = await jszip.file(p).async("uint8array");
        payloadZip.file(p, bytes, { date: new Date("1980-01-01T00:00:00.000Z") });
      }
      const payloadZipBytes = await payloadZip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const payloadSha = sha256Hex(Buffer.from(payloadZipBytes));
      if (payloadSha !== integrity.zip_sha256) {
        die(`❌ zip_sha256 mismatch (expected ${integrity.zip_sha256}, got ${payloadSha})`);
      }
    }
  }
} catch (e) {
  console.error("❌ verify-audit-pack failed:", e?.message || e);
  process.exit(1);
}
