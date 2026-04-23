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
  if (!trace.rule_to_evidence || typeof trace.rule_to_evidence !== "object") {
    throw new Error("trace.json missing rule_to_evidence");
  }
  if (!trace.verification_contract || typeof trace.verification_contract !== "object") {
    throw new Error("trace.json missing verification_contract");
  }
  const contract = trace.verification_contract;
  if (contract.mode !== "demo_placeholder_review_contract") {
    throw new Error("trace.json verification_contract missing mode=demo_placeholder_review_contract");
  }
  if (contract.project_path !== "project.json") throw new Error("trace.json verification_contract missing project.json path");
  if (contract.evidence_manifest_path !== "evidence-manifest.json") {
    throw new Error("trace.json verification_contract missing evidence-manifest.json path");
  }
  if (contract.requirement_review_path !== "requirement-review.json") {
    throw new Error("trace.json verification_contract missing requirement-review.json path");
  }
  if (contract.trail_path !== "trail.jsonl") throw new Error("trace.json verification_contract missing trail.jsonl path");
  if (contract.report_path !== "VERIFICATION_REPORT.html") {
    throw new Error("trace.json verification_contract missing VERIFICATION_REPORT.html path");
  }
  if (contract.placeholder !== true || typeof contract.placeholder_reason !== "string" || !contract.placeholder_reason.trim()) {
    throw new Error("trace.json verification_contract placeholder flag must be labeled");
  }
  if (!trace.rule_to_review || typeof trace.rule_to_review !== "object") {
    throw new Error("trace.json missing rule_to_review");
  }
  for (const [ruleId, review] of Object.entries(trace.rule_to_review)) {
    if (!review || typeof review !== "object") throw new Error(`trace.json rule_to_review ${ruleId} must be object`);
    if (review.requirement_review_path !== "requirement-review.json") {
      throw new Error(`trace.json rule_to_review ${ruleId} missing requirement-review.json path`);
    }
    if (review.rule_id !== ruleId) throw new Error(`trace.json rule_to_review ${ruleId} has mismatched rule_id`);
    if (review.status !== "awaiting_project_evidence") {
      throw new Error(`trace.json rule_to_review ${ruleId} missing awaiting_project_evidence status`);
    }
    if (!Array.isArray(review.linked_evidence_refs)) {
      throw new Error(`trace.json rule_to_review ${ruleId} missing linked_evidence_refs array`);
    }
    if (!Array.isArray(review.requested_evidence_refs)) {
      throw new Error(`trace.json rule_to_review ${ruleId} missing requested_evidence_refs array`);
    }
    if (review.placeholder !== true) throw new Error(`trace.json rule_to_review ${ruleId} must be marked placeholder`);
    if (!Array.isArray(trace.rule_to_evidence[ruleId])) {
      throw new Error(`trace.json rule_to_evidence ${ruleId} must be an array`);
    }
  }
}

function assertProjectJson(project) {
  if (!project || typeof project !== "object") throw new Error("project.json must be an object");
  if (project.kind !== "article6.verification_project") throw new Error("project.json missing kind");
  if (project.version !== 1) throw new Error("project.json missing version=1");
  if (typeof project.generated_at !== "string") throw new Error("project.json missing generated_at");
  if (!project.method || typeof project.method !== "object") throw new Error("project.json missing method");
  if (typeof project.method.code !== "string" || typeof project.method.version !== "string") {
    throw new Error("project.json method must include code and version");
  }
  if (!project.pack_profile || typeof project.pack_profile !== "object") {
    throw new Error("project.json missing pack_profile");
  }
  if (project.pack_profile.name !== "demo_verification_contract") {
    throw new Error("project.json missing demo_verification_contract profile");
  }
  if (project.pack_profile.not_a_formal_opinion !== true) {
    throw new Error("project.json must explicitly reject formal opinion status");
  }
  if (!project.project_context || typeof project.project_context !== "object") {
    throw new Error("project.json missing project_context");
  }
  if (project.project_context.placeholder !== true || typeof project.project_context.placeholder_reason !== "string") {
    throw new Error("project.json project_context placeholder must be labeled");
  }
  if (!project.reviewer_assignment || typeof project.reviewer_assignment !== "object") {
    throw new Error("project.json missing reviewer_assignment");
  }
  if (project.reviewer_assignment.placeholder !== true || typeof project.reviewer_assignment.placeholder_reason !== "string") {
    throw new Error("project.json reviewer_assignment placeholder must be labeled");
  }
}

function assertEvidenceManifest(evidenceManifest, manifestPaths) {
  if (!evidenceManifest || typeof evidenceManifest !== "object") throw new Error("evidence-manifest.json must be an object");
  if (evidenceManifest.kind !== "article6.evidence_manifest") throw new Error("evidence-manifest.json missing kind");
  if (evidenceManifest.version !== 1) throw new Error("evidence-manifest.json missing version=1");
  if (!evidenceManifest.method || typeof evidenceManifest.method !== "object") {
    throw new Error("evidence-manifest.json missing method");
  }
  if (typeof evidenceManifest.method.code !== "string" || typeof evidenceManifest.method.version !== "string") {
    throw new Error("evidence-manifest.json method must include code and version");
  }
  if (!evidenceManifest.placeholder_policy || typeof evidenceManifest.placeholder_policy !== "object") {
    throw new Error("evidence-manifest.json missing placeholder_policy");
  }
  if (evidenceManifest.placeholder_policy.all_entries_marked_placeholder !== true) {
    throw new Error("evidence-manifest.json must mark all entries as placeholder");
  }
  if (!Array.isArray(evidenceManifest.evidence)) throw new Error("evidence-manifest.json evidence must be an array");
  for (const entry of evidenceManifest.evidence) {
    if (!entry || typeof entry !== "object") throw new Error("evidence-manifest.json entry must be object");
    if (typeof entry.evidence_ref !== "string") throw new Error("evidence-manifest.json entry missing evidence_ref");
    if (!Array.isArray(entry.rule_ids) || !entry.rule_ids.every((id) => typeof id === "string")) {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} missing rule_ids`);
    }
    if (entry.status !== "not_provided") throw new Error(`evidence-manifest.json ${entry.evidence_ref} must use not_provided`);
    if (entry.status_basis !== "demo_placeholder") {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} must label demo_placeholder basis`);
    }
    if (entry.included_in_pack !== false) {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} must not claim included evidence`);
    }
    if (entry.file_path !== null || entry.sha256 !== null) {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} must not include fake file_path or sha256`);
    }
    if (entry.placeholder !== true || typeof entry.placeholder_reason !== "string" || !entry.placeholder_reason.trim()) {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} placeholder must be labeled`);
    }
    if (entry.file_path && !manifestPaths.has(entry.file_path)) {
      throw new Error(`evidence-manifest.json ${entry.evidence_ref} references missing file ${entry.file_path}`);
    }
  }
}

function assertRequirementReview(review, evidenceRefs) {
  if (!review || typeof review !== "object") throw new Error("requirement-review.json must be an object");
  if (review.kind !== "article6.requirement_review") throw new Error("requirement-review.json missing kind");
  if (review.version !== 1) throw new Error("requirement-review.json missing version=1");
  if (!review.method || typeof review.method !== "object") throw new Error("requirement-review.json missing method");
  if (typeof review.method.code !== "string" || typeof review.method.version !== "string") {
    throw new Error("requirement-review.json method must include code and version");
  }
  if (!review.placeholder_policy || typeof review.placeholder_policy !== "object") {
    throw new Error("requirement-review.json missing placeholder_policy");
  }
  if (review.placeholder_policy.all_rule_reviews_marked_placeholder !== true) {
    throw new Error("requirement-review.json must mark all rule reviews as placeholder");
  }
  if (!Array.isArray(review.rules)) throw new Error("requirement-review.json rules must be an array");
  for (const rule of review.rules) {
    if (!rule || typeof rule !== "object") throw new Error("requirement-review.json rule must be object");
    if (typeof rule.rule_id !== "string") throw new Error("requirement-review.json rule missing rule_id");
    if (rule.status !== "awaiting_project_evidence") {
      throw new Error(`requirement-review.json ${rule.rule_id} must use awaiting_project_evidence`);
    }
    if (rule.status_basis !== "demo_placeholder") {
      throw new Error(`requirement-review.json ${rule.rule_id} must label demo_placeholder basis`);
    }
    if (typeof rule.rationale !== "string" || !rule.rationale.trim()) {
      throw new Error(`requirement-review.json ${rule.rule_id} missing rationale`);
    }
    if (!Array.isArray(rule.linked_evidence_refs) || !Array.isArray(rule.requested_evidence_refs)) {
      throw new Error(`requirement-review.json ${rule.rule_id} missing evidence ref arrays`);
    }
    if (!rule.requested_evidence_refs.every((ref) => evidenceRefs.has(ref))) {
      throw new Error(`requirement-review.json ${rule.rule_id} references unknown requested evidence`);
    }
    if (rule.linked_evidence_refs.length !== 0) {
      throw new Error(`requirement-review.json ${rule.rule_id} must not link fake evidence refs`);
    }
    if (!rule.reviewer || typeof rule.reviewer !== "object") {
      throw new Error(`requirement-review.json ${rule.rule_id} missing reviewer`);
    }
    if (rule.reviewer.placeholder !== true || typeof rule.reviewer.placeholder_reason !== "string") {
      throw new Error(`requirement-review.json ${rule.rule_id} reviewer placeholder must be labeled`);
    }
    if (!rule.timestamps || typeof rule.timestamps !== "object") {
      throw new Error(`requirement-review.json ${rule.rule_id} missing timestamps`);
    }
    if (typeof rule.timestamps.record_created_at !== "string" || typeof rule.timestamps.last_updated_at !== "string") {
      throw new Error(`requirement-review.json ${rule.rule_id} missing record timestamps`);
    }
    if (rule.timestamps.reviewed_at !== null) {
      throw new Error(`requirement-review.json ${rule.rule_id} must not fake reviewed_at`);
    }
    if (!rule.methodology_trace || typeof rule.methodology_trace !== "object" || !Array.isArray(rule.methodology_trace.section_ids)) {
      throw new Error(`requirement-review.json ${rule.rule_id} missing methodology_trace`);
    }
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
  if (!entry.meta || typeof entry.meta !== "object") throw new Error(`${filename} line ${index} missing meta`);
}

function assertTrailEntries(entries, filename) {
  const actions = new Set(entries.map((entry) => entry.action));
  const requiredActions = [
    "trail.init",
    "verification_contract.project_seeded",
    "verification_contract.evidence_manifest_seeded",
    "verification_contract.requirement_review_seeded",
    "verification_contract.trace_updated",
    "verification_contract.report_derived",
  ];
  for (const action of requiredActions) {
    if (!actions.has(action)) throw new Error(`${filename} missing ${action}`);
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
  const manifestPathSet = new Set(manifestPaths);
  const allowed = new Set(["manifest.json", ...manifestPaths]);
  for (const requiredPath of [
    "project.json",
    "evidence-manifest.json",
    "requirement-review.json",
    "trace.json",
    "trail.jsonl",
    "VERIFICATION_REPORT.html",
  ]) {
    if (!manifestPaths.includes(requiredPath)) {
      die(`❌ manifest.json missing ${requiredPath} entry`);
    }
    if (!zipSet.has(requiredPath)) {
      die(`❌ ${requiredPath} missing from zip`);
    }
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

  let parsedProject = null;
  let parsedEvidenceManifest = null;
  let parsedRequirementReview = null;
  let parsedTrace = null;
  let ok = 0;
  let fail = 0;
  for (const f of manifest.files) {
    const p = f.path;
    const bytes = Buffer.from(zipReadBuf(zip, p));
    if (p === "trace.json") {
      try {
        parsedTrace = JSON.parse(bytes.toString("utf8"));
        assertTraceShape(parsedTrace);
      } catch (error) {
        console.error(`❌ INVALID TRACE ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }
    if (p === "project.json") {
      try {
        parsedProject = JSON.parse(bytes.toString("utf8"));
        assertProjectJson(parsedProject);
      } catch (error) {
        console.error(`❌ INVALID PROJECT ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }
    if (p === "evidence-manifest.json") {
      try {
        parsedEvidenceManifest = JSON.parse(bytes.toString("utf8"));
        assertEvidenceManifest(parsedEvidenceManifest, manifestPathSet);
      } catch (error) {
        console.error(`❌ INVALID EVIDENCE MANIFEST ${p}\n  ${error?.message || error}`);
        fail++;
        continue;
      }
    }
    if (p === "requirement-review.json") {
      try {
        parsedRequirementReview = JSON.parse(bytes.toString("utf8"));
        const evidenceRefs = new Set((parsedEvidenceManifest?.evidence ?? []).map((entry) => entry.evidence_ref));
        assertRequirementReview(parsedRequirementReview, evidenceRefs);
      } catch (error) {
        console.error(`❌ INVALID REQUIREMENT REVIEW ${p}\n  ${error?.message || error}`);
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
        assertTrailEntries(entries, p);
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

  if (fail === 0) {
    try {
      if (!parsedProject || !parsedEvidenceManifest || !parsedRequirementReview || !parsedTrace) {
        throw new Error("cross-file validation missing parsed artifacts");
      }
      const reviewRules = new Map(parsedRequirementReview.rules.map((rule) => [rule.rule_id, rule]));
      const evidenceRefs = new Set(parsedEvidenceManifest.evidence.map((entry) => entry.evidence_ref));
      for (const [ruleId, reviewRef] of Object.entries(parsedTrace.rule_to_review ?? {})) {
        if (!reviewRules.has(ruleId)) throw new Error(`trace.json references missing rule review for ${ruleId}`);
        if (!reviewRef.requested_evidence_refs.every((ref) => evidenceRefs.has(ref))) {
          throw new Error(`trace.json references unknown requested evidence for ${ruleId}`);
        }
      }
      for (const rule of parsedRequirementReview.rules) {
        if (!(rule.rule_id in parsedTrace.rule_to_evidence)) {
          throw new Error(`trace.json missing rule_to_evidence entry for ${rule.rule_id}`);
        }
      }
    } catch (error) {
      console.error(`❌ INVALID CONTRACT CROSS-REFS\n  ${error?.message || error}`);
      fail++;
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
