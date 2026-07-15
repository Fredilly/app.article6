#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = "tests/fixtures/preverif";
const TRUTH_FILES = new Set(["gold.json", "corrections.json", "reviewedRuleIds.json", "independent-audit.json", "metadata.json"]);
const GOLD_FILES = new Set(["gold.json", "corrections.json", "reviewedRuleIds.json", "metadata.json"]);
const RAW_FILES = new Set(["raw-document-extraction.json", "raw-evidence-map.json", "raw-quick-check-output.txt", "quick-check-output.json", "machine-proposal.json", "machine-proposal-post-999-review-candidate.json", "gold.draft.json"]);

function git(args) { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === "--base-ref") out.baseRef = argv[++i]; else if (argv[i]?.startsWith("--base-ref=")) out.baseRef = argv[i].slice(11); } return out; }
function resolveBase(cli) { return cli?.trim() || process.env.PREVERIF_TRUTH_GUARD_BASE?.trim() || (process.env.GITHUB_BASE_REF?.trim() ? `origin/${process.env.GITHUB_BASE_REF.trim()}` : "origin/main"); }
function changed(ref) { const value = git(["diff", "--name-only", `${ref}...HEAD`]); return value ? value.split("\n").filter(Boolean) : []; }
function textAt(ref, file) { try { return git(["show", `${ref}:${file}`]); } catch { return undefined; } }
function jsonAt(ref, file) { const value = textAt(ref, file); try { return value === undefined ? undefined : JSON.parse(value); } catch { return undefined; } }
function currentJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { if (fs.existsSync(file)) return { __malformedTruthFile: true }; return undefined; } }
function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value) ?? "undefined"; }
function hash(value) { return crypto.createHash("sha256").update(canonical(value)).digest("hex"); }
function rows(value) { return Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : []; }
function ruleId(row) { return row?.ruleId ?? row?.stableRuleId ?? row?.ruleReference; }
function auditId(row) { return row?.ruleReference ?? row?.ruleId ?? row?.stableRuleId; }
function same(a, b) { return canonical(a) === canonical(b); }
function fixtureOf(file) { return file.match(/^tests\/fixtures\/preverif\/([^/]+)\//)?.[1]; }
function idsFromGold(value) { return Array.isArray(value?.reviewedRuleIds) ? value.reviewedRuleIds : rows(value).map(ruleId); }
function idsFromAudit(value) { return rows(value).map(auditId); }
function isPrefix(oldIds, newIds) { return oldIds.length <= newIds.length && oldIds.every((id, index) => id === newIds[index]); }
function addFailure(failures, message) { failures.push(message); }
function parseRequiredJson(failures, file, value, structure) {
  if (value === undefined) { addFailure(failures, `required truth file missing or deleted: ${file}`); return; }
  if (!structure(value)) addFailure(failures, `required truth file has wrong structure or is malformed: ${file}`);
}

function methodologyRules() {
  const result = new Map();
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === "rules.rich.json") {
        try {
          const value = JSON.parse(fs.readFileSync(file, "utf8"));
          for (const rule of Array.isArray(value) ? value : []) if (rule?.stable_id) result.set(rule.stable_id, [...(result.get(rule.stable_id) ?? []), rule]);
        } catch { /* malformed packs are reported as missing authoritative rules */ }
      }
    }
  }
  walk(path.join(process.cwd(), "public/methodologies"));
  return result;
}

function normalized(value) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value; }
function authoritativeVersion(stableId) {
  const match = /^.+?\.v(\d+)(?:-(\d+))?\./.exec(stableId ?? "");
  return match ? `v${match[1]}${match[2] ? `.${match[2]}` : ""}` : undefined;
}
function validateTraceability(failures, row, rules) {
  const id = ruleId(row); const matches = rules.get(id) ?? []; const trace = row?.methodologyTraceability;
  if (matches.length !== 1) return addFailure(failures, `methodology authoritative rule missing or duplicated for ${id}`);
  const authoritative = matches[0]; const expectedVersion = authoritativeVersion(authoritative.stable_id);
  const required = ["methodology", "version", "section", "methodologyPage", "officialRequirementQuote", "source_span_status"];
  if (!trace || required.some((field) => trace[field] === undefined || trace[field] === null || trace[field] === "")) addFailure(failures, `methodology traceability fields missing for ${id}`);
  if (trace?.officialRequirementQuote !== authoritative.source_span_text) addFailure(failures, `methodology quote mismatch for ${id}`);
  if (trace?.methodologyPage !== authoritative.section_context?.page_start) addFailure(failures, `methodology page mismatch for ${id}`);
  if (normalized(trace?.section) !== normalized(authoritative.section_context?.section_title)) addFailure(failures, `methodology section mismatch for ${id}`);
  if (trace?.version !== expectedVersion) addFailure(failures, `methodology version mismatch for ${id}`);
  if (authoritative.source_span_status !== "source_audited" || trace?.source_span_status !== "source_audited") addFailure(failures, `methodology source span is not audited for ${id}`);
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((key) => !same(before?.[key], after?.[key])).sort();
}
function reconciliationRecords(metadata) {
  const value = metadata?.review?.reconciliation ?? metadata?.reconciliation;
  return Array.isArray(value) ? value : [];
}
function validateReconciliationMetadata(failures, metadata, oldRows, newRows, rules, acceptedEvidenceIds = new Set()) {
  const records = reconciliationRecords(metadata); const changedIds = new Set(newRows.map((row, index) => same(row, oldRows[index]) ? undefined : ruleId(row)).filter(Boolean));
  const recordIds = records.map((record) => record?.ruleId);
  if (new Set(recordIds).size !== recordIds.length || recordIds.some((id) => !id)) addFailure(failures, "reconciliation metadata rule IDs must be unique and non-empty");
  if (records.length !== changedIds.size) addFailure(failures, "reconciliation metadata must contain exactly one record for every changed gold row");
  const byId = new Map(records.map((record) => [record?.ruleId, record]));
  for (const [index, after] of newRows.entries()) {
    const before = oldRows[index]; if (same(before, after)) continue;
    const id = ruleId(after); const record = byId.get(id); const fields = changedFields(before, after);
    if (!record) { addFailure(failures, `reconciliation metadata missing for ${id}`); continue; }
    if (record.oldHash !== hash(before) || record.newHash !== hash(after)) addFailure(failures, `reconciliation hash record mismatch for ${id}`);
    if (!same(record.changedFields, fields)) addFailure(failures, `reconciliation changedFields mismatch for ${id}`);
    const supportedFields = ["finalEvidenceState", "reviewerOutcome", "rationale", "clientAction", "draftFindingCandidate", "reviewerCorrection", "contradictionState", "reviewStatus"];
    const evidenceExplicitlyReconciled = fields.includes("acceptedEvidence") && record.changedFields?.includes("acceptedEvidence") && acceptedEvidenceIds.has(id);
    if (evidenceExplicitlyReconciled) supportedFields.push("acceptedEvidence");
    if (fields.some((field) => !supportedFields.includes(field))) addFailure(failures, `unsupported reconciliation field for ${id}`);
    if (typeof record.reviewerRationale !== "string" || !record.reviewerRationale.trim()) addFailure(failures, `reconciliation reviewer rationale missing for ${id}`);
    if (fields.includes("methodologyTraceability")) addFailure(failures, `reconciliation may not change methodology traceability for ${id}`);
    else if (same(before?.methodologyTraceability, after?.methodologyTraceability)) { /* legacy traceability is preserved exactly */ }
    else validateTraceability(failures, after, rules);
  }
  for (const record of records) if (!changedIds.has(record?.ruleId)) addFailure(failures, `reconciliation metadata has no changed gold row for ${record?.ruleId}`);
}

function listTestFiles(ref) {
  const value = git(["ls-tree", "-r", "--name-only", ref, "tests/lib/preverif"]); return value.split("\n").filter((file) => /\.test\.(ts|tsx|js|jsx)$/.test(file));
}
function protectTests(failures, baseRef, fixture, headFiles, isNew) {
  const baseFiles = listTestFiles(baseRef); const headSet = new Set(headFiles); const headReferenced = headFiles.filter((file) => (textAt("HEAD", file) ?? "").includes(`tests/fixtures/preverif/${fixture}`) || (textAt("HEAD", file) ?? "").includes(fixture));
  if (isNew && !headReferenced.length) addFailure(failures, `new fixture ${fixture} requires a real Jest test`);
  for (const file of baseFiles) {
    const before = textAt(baseRef, file); const after = textAt("HEAD", file);
    if (!headSet.has(file) || after === undefined) addFailure(failures, `existing preverif test deleted: ${file}`);
    else if (before !== after && !(before.includes(`tests/fixtures/preverif/${fixture}`) && after.includes(`tests/fixtures/preverif/${fixture}`))) addFailure(failures, `existing regression test file is immutable: ${file}`);
  }
}

function finalTruthProjection(row) {
  const result = { ruleId: ruleId(row) };
  for (const field of ["finalEvidenceState", "reviewerOutcome", "rationale", "clientAction", "draftFindingCandidate", "contradictionState"]) if (Object.hasOwn(row ?? {}, field)) result[field] = row[field];
  return result;
}
function sectionEntries(value, section) { return Array.isArray(value?.[section]) ? value[section] : []; }
function validateCorrections(failures, baseCorrections, currentCorrections, targetIds, goldRows) {
  const sections = ["acceptedEvidence", "rejectedEvidence", "reviewerCorrections", "finalTruth"];
  const additions = new Map();
  const targetIdSet = new Set(targetIds);
  for (const section of sections) {
    const before = sectionEntries(baseCorrections, section); const after = sectionEntries(currentCorrections, section);
    const oldUntouched = before.filter((row) => !targetIdSet.has(row?.ruleId));
    const newUntouched = after.filter((row) => !targetIdSet.has(row?.ruleId));
    if (!isPrefix(oldUntouched.map((row) => hash(row)), newUntouched.map((row) => hash(row)))) addFailure(failures, `corrections.${section} must preserve its ordered hash-stable prefix`);
    additions.set(section, after.filter((row) => !before.some((oldRow) => hash(oldRow) === hash(row))));
  }
  const allowed = new Set(targetIds); const byId = (section, id, field) => sectionEntries(currentCorrections, section).filter((entry) => entry?.ruleId === id).map((entry) => entry[field]); const addedById = (section, id, field) => additions.get(section).filter((entry) => entry?.ruleId === id).map((entry) => entry[field]);
  for (const section of sections) for (const entry of additions.get(section)) if (!allowed.has(entry?.ruleId)) addFailure(failures, `new corrections.${section} entry references unknown or untouched rule ${entry?.ruleId}`);
  for (const section of ["reviewerCorrections", "finalTruth"]) {
    const ids = additions.get(section).map((entry) => entry?.ruleId);
    if (new Set(ids).size !== ids.length) addFailure(failures, `new corrections.${section} entries must not duplicate rule IDs`);
  }
  for (const id of targetIds) {
    const gold = goldRows.find((row) => ruleId(row) === id);
    const accepted = byId("acceptedEvidence", id, "evidence"); const rejected = sectionEntries(currentCorrections, "rejectedEvidence").filter((entry) => entry?.ruleId === id).map((entry) => entry.evidence); const reviewers = byId("reviewerCorrections", id, "correction"); const finalTruth = (additions.get("finalTruth").filter((entry) => entry?.ruleId === id).length ? additions.get("finalTruth").filter((entry) => entry?.ruleId === id) : sectionEntries(currentCorrections, "finalTruth").filter((entry) => entry?.ruleId === id)); const addedReviewers = addedById("reviewerCorrections", id, "correction");
    if (!same(accepted, gold?.acceptedEvidence ?? [])) addFailure(failures, `new corrections acceptedEvidence disagrees with gold for ${id}`);
    if (!same(rejected, (gold?.rejectedEvidence ?? []).map((entry) => entry?.evidence ?? entry))) addFailure(failures, `new corrections rejectedEvidence disagrees with gold for ${id}`);
    const reviewerMatches = (value) => same(value, gold?.reviewerCorrection) || same(value?.correction, gold?.reviewerCorrection?.correction);
    if (gold?.reviewerCorrection === undefined ? reviewers.length !== 0 : (addedReviewers.length ? addedReviewers.length !== 1 || !reviewerMatches(addedReviewers[0]) : reviewers.length !== 1 || !reviewerMatches(reviewers[0]))) addFailure(failures, `new corrections reviewerCorrection disagrees with gold for ${id}`);
    if (finalTruth.length !== 1) addFailure(failures, `new corrections must contain exactly one finalTruth entry for ${id}`);
    else if (!same(finalTruth[0], finalTruthProjection(gold))) addFailure(failures, `new corrections finalTruth disagrees with gold for ${id}`);
  }
}

function canonicalAuditId(id, goldIds) {
  const matches = goldIds.filter((goldId) => goldId === id || String(goldId).endsWith(`.${id}`));
  return matches.length === 1 ? matches[0] : undefined;
}
function validateAuditRows(failures, auditRows, goldIds) {
  const canonicalIds = auditRows.map((row) => canonicalAuditId(auditId(row), goldIds));
  if (canonicalIds.some((id) => !id)) addFailure(failures, "independent audit rule must correspond to an already reviewed gold rule");
  if (new Set(canonicalIds).size !== canonicalIds.length) addFailure(failures, "independent audit canonical rule IDs must be unique");
  for (const row of auditRows) {
    const state = row?.finalState; const outcome = row?.reviewerOutcome;
    if (!["FOUND", "UNCLEAR", "MISSING", "N/A"].includes(state)) addFailure(failures, `independent audit has invalid finalState for ${auditId(row)}`);
    if (!["CONFORMS", "ACTION_REQUIRED", "NOT_APPLICABLE"].includes(outcome)) addFailure(failures, `independent audit has invalid reviewerOutcome for ${auditId(row)}`);
    if ((state === "FOUND" && outcome !== "CONFORMS") || (["UNCLEAR", "MISSING"].includes(state) && outcome !== "ACTION_REQUIRED") || (state === "N/A" && outcome !== "NOT_APPLICABLE")) addFailure(failures, `independent audit has invalid state/outcome combination for ${auditId(row)}`);
    if (typeof row?.rationale !== "string" || !row.rationale.trim()) addFailure(failures, `independent audit rationale is required for ${auditId(row)}`);
  }
}

function main() {
  const baseRef = resolveBase(parseArgs(process.argv.slice(2)).baseRef); const files = changed(baseRef); const truthFiles = files.filter((file) => TRUTH_FILES.has(path.basename(file)) && fixtureOf(file));
  if (!truthFiles.length) { console.log(`[preverif-truth-guard] ok base=${baseRef} changed=0 (no truth artifacts)`); return; }
  const failures = []; const allFixtures = new Set(files.map(fixtureOf).filter(Boolean)); const fixtures = new Set(truthFiles.map(fixtureOf));
  if (fixtures.size !== 1 || allFixtures.size !== 1) addFailure(failures, "truth review must change exactly one preverif fixture directory");
  const fixture = [...fixtures][0];
  for (const file of files) {
    const currentFixture = fixtureOf(file); const allowed = file === "scripts/preverif/check-truth-review-guard.mjs" || file.startsWith("tests/lib/preverif/") || file.startsWith("docs/agents/") || (currentFixture && currentFixture === fixture);
    if (!allowed) addFailure(failures, `truth review change outside affected fixture/tests/docs: ${file}`);
    if (currentFixture && currentFixture !== fixture) addFailure(failures, `another fixture changed: ${file}`);
    if (currentFixture === fixture && RAW_FILES.has(path.basename(file))) addFailure(failures, `raw machine artifact must remain unchanged in every truth-review stage: ${file}`);
  }
  if (!fixture) { addFailure(failures, "truth artifact fixture directory could not be resolved"); return report(failures, baseRef); }
  const dir = `${ROOT}/${fixture}`; const gold0 = jsonAt(baseRef, `${dir}/gold.json`); const gold1 = currentJson(`${dir}/gold.json`); const audit0 = jsonAt(baseRef, `${dir}/independent-audit.json`); const audit1 = currentJson(`${dir}/independent-audit.json`); const names = new Set(files.filter((file) => fixtureOf(file) === fixture).map((file) => path.basename(file))); const isNew = gold0 === undefined && audit0 === undefined; const rules = methodologyRules();
  const baseCorrections = jsonAt(baseRef, `${dir}/corrections.json`); const currentCorrections = currentJson(`${dir}/corrections.json`); const baseReviewed = jsonAt(baseRef, `${dir}/reviewedRuleIds.json`); const currentReviewed = currentJson(`${dir}/reviewedRuleIds.json`); const baseMetadata = jsonAt(baseRef, `${dir}/metadata.json`); const currentMetadata = currentJson(`${dir}/metadata.json`);
  parseRequiredJson(failures, `${dir}/gold.json`, gold1, (value) => value && !Array.isArray(value) && Array.isArray(value.reviewedRuleIds) && Array.isArray(value.rows) && value.rows.every((row) => row && ruleId(row)));
  parseRequiredJson(failures, `${dir}/corrections.json`, currentCorrections, (value) => value && !Array.isArray(value) && Array.isArray(value.reviewedRuleIds) && ["acceptedEvidence", "rejectedEvidence", "reviewerCorrections", "finalTruth"].every((name) => value[name] === undefined || Array.isArray(value[name])));
  parseRequiredJson(failures, `${dir}/reviewedRuleIds.json`, currentReviewed, (value) => value && Array.isArray(value.reviewedRuleIds));
  parseRequiredJson(failures, `${dir}/metadata.json`, currentMetadata, (value) => value && !Array.isArray(value) && value.review && Array.isArray(value.review.reviewedRuleIds));
  if (!isNew || names.has("independent-audit.json")) parseRequiredJson(failures, `${dir}/independent-audit.json`, audit1, (value) => value && !Array.isArray(value) && Array.isArray(value.rows) && value.rows.every((row) => row && auditId(row)));
  const auditAppendPreserved = !isNew && rows(audit1).length > rows(audit0).length && same(idsFromAudit(audit0), idsFromAudit(audit1).slice(0, rows(audit0).length));
  if (names.has("gold.json") && names.has("independent-audit.json") && !isNew && !auditAppendPreserved) addFailure(failures, "gold and independent audit cannot change together");
  if (isNew && (!names.has("gold.json") || names.has("independent-audit.json"))) addFailure(failures, "new fixtures allow gold intake only and cannot add independent audit");
  if (!isNew && !names.has("gold.json") && ["corrections.json", "reviewedRuleIds.json", "metadata.json"].some((name) => names.has(name))) addFailure(failures, "corrections/reviewedRuleIds/metadata require gold.json");
  const oldGoldIds = idsFromGold(gold0); const newGoldIds = idsFromGold(gold1); const oldGoldRows = rows(gold0); const newGoldRows = rows(gold1);
  if (gold1 && (names.has("gold.json") || isNew)) {
    if (new Set(newGoldIds).size !== newGoldIds.length || newGoldRows.length !== newGoldIds.length || !same(newGoldIds, newGoldRows.map(ruleId))) addFailure(failures, "gold reviewedRuleIds and rows must contain the same unique ordered IDs");
    for (const [name, field] of [["reviewedRuleIds.json", "reviewedRuleIds"], ["corrections.json", "reviewedRuleIds"], ["metadata.json", "review.reviewedRuleIds"]]) { const value = currentJson(`${dir}/${name}`); const ids = field.split(".").reduce((object, key) => object?.[key], value); if (!same(ids, newGoldIds)) addFailure(failures, `${name} reviewedRuleIds do not match gold`); }
  }
  if (isNew && gold1 && Array.isArray(gold1.rows)) for (const row of gold1.rows) validateTraceability(failures, row, rules);
  if (gold0 && gold1 && names.has("gold.json")) {
    if (newGoldIds.length < oldGoldIds.length || (newGoldIds.length > oldGoldIds.length && !isPrefix(oldGoldIds, newGoldIds))) addFailure(failures, "gold reviewedRuleIds must preserve the ordered prefix");
    if (newGoldIds.length === oldGoldIds.length) {
      if (!same(oldGoldIds, newGoldIds)) addFailure(failures, "reconciliation reordered reviewedRuleIds");
      if (!names.has("REVIEW.md")) addFailure(failures, "reconciliation must change REVIEW.md");
      if (!names.has("metadata.json")) addFailure(failures, "reconciliation must change metadata with explicit records");
      const reconciliationMetadata = currentJson(`${dir}/metadata.json`);
      const acceptedEvidenceIds = new Set(reconciliationRecords(reconciliationMetadata).filter((record) => record?.changedFields?.includes("acceptedEvidence")).map((record) => record.ruleId).filter((id) => rows(audit1).find((row) => canonicalAuditId(auditId(row), newGoldIds) === id && row.auditResult === "CORRECTED")));
      validateReconciliationMetadata(failures, reconciliationMetadata, oldGoldRows, newGoldRows, rules, acceptedEvidenceIds);
      const changedIds = newGoldRows.filter((row, index) => !same(row, oldGoldRows[index])).map(ruleId);
      validateCorrections(failures, baseCorrections, currentCorrections, changedIds, newGoldRows);
      const auditRows = rows(audit1);
      for (const [index, row] of newGoldRows.entries()) if (!same(row, oldGoldRows[index])) { const id = ruleId(row); const audit = auditRows.find((candidate) => auditId(candidate) === id || String(id).endsWith(`.${auditId(candidate)}`)); if (!audit) addFailure(failures, `reconciliation lacks independent audit coverage for ${id}`); else { if (audit.finalState !== row.finalEvidenceState) addFailure(failures, `audit finalState mismatch for ${id}`); if (audit.reviewerOutcome !== row.reviewerOutcome) addFailure(failures, `audit reviewerOutcome mismatch for ${id}`); } }
    } else {
      if (names.has("independent-audit.json")) addFailure(failures, "gold intake cannot change independent-audit.json");
      for (const [index, row] of oldGoldRows.entries()) if (!same(row, newGoldRows[index])) addFailure(failures, `previous gold row ${oldGoldIds[index]} hash changed old=${hash(row)} new=${hash(newGoldRows[index])}`);
      for (const [index, row] of newGoldRows.entries()) if (!gold0 || !same(row, oldGoldRows[index])) validateTraceability(failures, row, rules);
      validateCorrections(failures, baseCorrections, currentCorrections, newGoldIds.slice(oldGoldIds.length), newGoldRows);
    }
  }
  if (isNew && gold1 && currentCorrections) validateCorrections(failures, baseCorrections, currentCorrections, newGoldIds, newGoldRows);
  if (audit1 && names.has("independent-audit.json")) {
    if ([...GOLD_FILES].some((name) => names.has(name)) && !auditAppendPreserved) addFailure(failures, "independent-audit intake must keep all gold artifacts unchanged");
    const before = rows(audit0); const after = rows(audit1);
    validateAuditRows(failures, after, newGoldIds);
    for (const [index, row] of before.entries()) if (!same(row, after[index])) addFailure(failures, `previous independent-audit row ${auditId(row)} hash changed old=${hash(row)} new=${hash(after[index])}`);
  }
  protectTests(failures, baseRef, fixture, listTestFiles("HEAD"), isNew); report(failures, baseRef);
}
function report(failures, baseRef) { if (failures.length) { console.error("[preverif-truth-guard] blocked"); for (const failure of failures) console.error(`[preverif-truth-guard] ${failure}`); process.exit(1); } console.log(`[preverif-truth-guard] ok base=${baseRef}`); }
try { main(); } catch (error) { console.error(`[preverif-truth-guard] error ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
