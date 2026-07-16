import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { canonicalJsonStringify } from "../../src/lib/export/canonicalJson";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { compareBenchmarkMetric, evaluateVm0007Benchmark, machineProposalToBenchmarkRows, reviewedTruthToBenchmarkRows } from "../../src/lib/preverif/vm0007Benchmark";
import { evaluateVm0007EvidenceBenchmark, normalizeEvidenceQuote } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { changedVm0007RuleIds, mapDiagnosticTracesByRuleId, removedEvidenceIsBaselineFalseSupport, substantiveDiagnosticTrace, validateVm0007ManualReview, VM0007_REVIEW_CLASSIFICATIONS } from "../../src/lib/preverif/vm0007BenchmarkIntegrity";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const files = {
  registry: path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC3_BASELINE_REGISTRY.json"),
  baseline: path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json"),
  baselineProposal: path.join(artifactDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json"),
  diagnostic: path.join(artifactDir, "RC3_AUDITED_DIAGNOSTIC.json"),
  truth: path.join(fixtureDir, "gold.json"),
  extraction: path.join(fixtureDir, "raw-document-extraction.json"),
  manualReview: path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANUAL_REVIEW.json"),
  rules: path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json"),
  richRules: path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json"),
};
const expectedHashes = {
  baseline: "12c6276c12ba62d7f93987e3d4097d732ab05ded1432621a5895aa7527e5be87",
  baselineProposal: "2ffe9413b09a795edc50b15e9564716f9fcf51d916f13368b416d2b22088fb85",
  truth: "af93a39a0b874377efe88648f6f4538c2454c9e8dcceae66086681b4a336f75c",
  extraction: "7031b49bf70d541679788e65f74efef09921712a506a0ba4aa28d0b0bcd98747",
  preFixAuditExecution: "770b05a6e82757d436c9f40c7698742f64ae1ad8c906b3b127926027f5198a25",
  diagnostic: "3dc8f4616eae03b1bfbc44e2a872f7177d56c06766c0524e22571573b6b298bd",
} as const;
const read = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256Bytes = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const sha256Text = (text: string) => crypto.createHash("sha256").update(text, "utf8").digest("hex");
const relative = (file: string) => path.relative(root, file);
const write = (file: string, text: string) => fs.writeFileSync(file, text, "utf8");
const assertHash = (name: keyof typeof expectedHashes, file: string) => {
  const expected = expectedHashes[name];
  if (name === "preFixAuditExecution") return;
  const actual = sha256Bytes(file);
  if (actual !== expected) throw new Error(`Frozen ${name} hash mismatch: expected ${expected}, received ${actual}`);
  return actual;
};

const registry = read(files.registry);
const versions = registry.versions.filter((version: any) => version.logicalVersion === "v2" && version.status === "frozen_current" && version.purpose === "official RC3 audited pre-fix starting point");
if (versions.length !== 1) throw new Error(`Expected exactly one frozen_current logicalVersion v2 registry entry; found ${versions.length}`);
const frozen = versions[0];
if (frozen.generatedSameRunProposal.sha256 !== expectedHashes.baselineProposal || frozen.productionExecution.auditExecutionSha256 !== expectedHashes.preFixAuditExecution) throw new Error("Selected frozen registry entry does not identify the authoritative frozen inputs");
assertHash("baseline", files.baseline);
assertHash("baselineProposal", files.baselineProposal);
assertHash("truth", files.truth);
assertHash("extraction", files.extraction);
assertHash("diagnostic", files.diagnostic);

const truth = read(files.truth);
const manualReview = read(files.manualReview);
const frozenDiagnostic = read(files.diagnostic);
const extraction = read(files.extraction);
const rulesRegistry = read(files.rules);
const expectedStableRuleIds = rulesRegistry.rules.map((rule: { stable_id: string }) => rule.stable_id);
if (new Set(expectedStableRuleIds).size !== 58) throw new Error(`VM0007 registry must contain 58 unique stable IDs; found ${expectedStableRuleIds.length}`);
const context = getStructuredQueryContext(extraction.text);
const rules = read(files.richRules).map((rule: Record<string, unknown>) => ({
  id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""),
  text: String(rule.text ?? ""), type: String(rule.type ?? ""), snippet: String(rule.snippet ?? rule.text ?? ""), tags: [],
}));
const audit = auditEvidence({
  rules: rules.map(({ id, title, summary, logic, text, type }: any) => ({ id, title, summary, logic, text, type })),
  evidenceDocument: context.evidenceDocument, getContract: getVm0007EvidenceContract, normalizeRuleId: normalizeVm0007RuleId,
  sections: context.documentStructure.sections, rawText: extraction.text, diagnosticTrace: true,
  versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
});
const auditExecutionSha256 = sha256Text(canonicalJsonStringify(audit));
const draft = buildVm0007EvidenceMapDraft({
  auditId: "rc3-audited-post-fix-benchmark-marcondes-vm0007-v18", generatedAt: "1970-01-01T00:00:00.000Z", rules, audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: context.evidenceDocument.contentSha256 },
});
if (!draft.ok) throw new Error(`Post-fix proposal blocked: ${draft.blockedBy.join(", ")}`);
const proposalSerialized = canonicalJsonStringify(draft.package);
const proposal = JSON.parse(proposalSerialized);
const stableRuleIds = proposal.rows.map((row: any) => row.stableRuleId);
if (proposal.rows.length !== 58 || new Set(stableRuleIds).size !== 58 || stableRuleIds.some((id: string) => !new Set(expectedStableRuleIds).has(id))) throw new Error("Post-fix serialized reload does not contain exactly the 58 expected unique rules");
const baselineProposal = read(files.baselineProposal);
const baselineEvidence = evaluateVm0007EvidenceBenchmark({ machineRows: baselineProposal.rows, reviewedRows: truth.rows, expectedStableRuleIds });
const postFixEvidence = evaluateVm0007EvidenceBenchmark({ machineRows: proposal.rows, reviewedRows: truth.rows, expectedStableRuleIds });
const postFixDiagnosticById = mapDiagnosticTracesByRuleId(audit.diagnosticTrace ?? [], expectedStableRuleIds);
// The frozen diagnostic artifact contains events derived only from accepted-evidence
// false negatives. Reconstruct the same per-rule miss slices from the post-fix
// audit; this is not a claim of complete raw audit-trace equality. The complete
// serialized proposal-row comparison remains a separate measurement.
const frozenDiagnosticById = new Map<string, unknown>(expectedStableRuleIds.map((id: string) => [id, []]));
const frozenEventIds = new Set<string>();
for (const event of frozenDiagnostic.events) {
  const id = typeof event?.stableRuleId === "string" ? event.stableRuleId.trim() : "";
  if (!id || !expectedStableRuleIds.includes(id)) throw new Error(`Frozen diagnostic contains unknown or empty stable rule ID: ${id || "empty"}`);
  if (typeof event.eventId !== "string" || frozenEventIds.has(event.eventId)) throw new Error(`Frozen diagnostic contains duplicate or invalid event ID for ${id}`);
  frozenEventIds.add(event.eventId);
  const details = frozenDiagnosticById.get(id) as unknown[];
  details.push(event.detail);
}
const postFalseNegativeTraceById = new Map<string, unknown[]>(expectedStableRuleIds.map((id: string) => [id, []]));
for (const row of postFixEvidence.rows) {
  for (const record of row.accepted.falseNegativeRecords) {
    const trace = postFixDiagnosticById.get(row.stableRuleId) as any;
    const matches = (candidate: any) => normalizeEvidenceQuote(String(candidate.quote ?? "")).includes(normalizeEvidenceQuote(String(record.quote ?? "")));
    (postFalseNegativeTraceById.get(row.stableRuleId)!).push({
      retrievalCandidates: trace.retrievalCandidates.filter(matches),
      postFilterCandidates: trace.postFilterCandidates.filter(matches),
      selectedCandidates: trace.selectedCandidates.filter(matches),
      cutoffPosition: trace.cutoffPosition,
    });
  }
}
const serializedRowChangedRuleIds = changedVm0007RuleIds(baselineProposal.rows, proposal.rows, expectedStableRuleIds);
const acceptedEvidenceMissDiagnosticChangedRuleIds = expectedStableRuleIds.filter((id: string) => canonicalJsonStringify(substantiveDiagnosticTrace(frozenDiagnosticById.get(id))) !== canonicalJsonStringify(substantiveDiagnosticTrace(postFalseNegativeTraceById.get(id)))).sort();
const changedRuleIds = changedVm0007RuleIds(baselineProposal.rows, proposal.rows, expectedStableRuleIds, frozenDiagnosticById, postFalseNegativeTraceById);
const reviewedBenchmarkRows = reviewedTruthToBenchmarkRows(truth.rows);
const baselineCategorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(baselineProposal.rows), reviewedRows: reviewedBenchmarkRows, expectedStableRuleIds });
const postFixCategorical = evaluateVm0007Benchmark({ machineRows: machineProposalToBenchmarkRows(proposal.rows), reviewedRows: reviewedBenchmarkRows, expectedStableRuleIds });
const lower = (baseline: number | null, postFix: number | null) => compareBenchmarkMetric(baseline, postFix, "lower_is_better");
const higher = (baseline: number | null, postFix: number | null) => compareBenchmarkMetric(baseline, postFix, "higher_is_better");
const metrics = {
  acceptedEvidenceFalseSupport: lower(baselineEvidence.aggregate.accepted.falsePositiveCount, postFixEvidence.aggregate.accepted.falsePositiveCount),
  acceptedEvidenceMissed: lower(baselineEvidence.aggregate.accepted.falseNegativeCount, postFixEvidence.aggregate.accepted.falseNegativeCount),
  evidenceStateFailures: lower(baselineCategorical.aggregate.fields.evidenceState.mismatchedCount, postFixCategorical.aggregate.fields.evidenceState.mismatchedCount),
  applicabilityFailures: lower(baselineCategorical.aggregate.fields.applicability.mismatchedCount, postFixCategorical.aggregate.fields.applicability.mismatchedCount),
  reviewerOutcomeFailures: lower(baselineCategorical.aggregate.fields.reviewerOutcome.mismatchedCount, postFixCategorical.aggregate.fields.reviewerOutcome.mismatchedCount),
  contradictionFailures: lower(baselineCategorical.aggregate.fields.contradictionState.mismatchedCount, postFixCategorical.aggregate.fields.contradictionState.mismatchedCount),
  draftFindingFailures: lower(baselineCategorical.aggregate.fields.draftFinding.mismatchedCount, postFixCategorical.aggregate.fields.draftFinding.mismatchedCount),
  clientActionFailures: lower(baselineCategorical.aggregate.fields.clientAction.mismatchedCount, postFixCategorical.aggregate.fields.clientAction.mismatchedCount),
  acceptedEvidencePrecision: higher(baselineEvidence.aggregate.accepted.precision, postFixEvidence.aggregate.accepted.precision),
  acceptedEvidenceRecall: higher(baselineEvidence.aggregate.accepted.recall, postFixEvidence.aggregate.accepted.recall),
  acceptedEvidenceF1: higher(baselineEvidence.aggregate.accepted.f1, postFixEvidence.aggregate.accepted.f1),
};
validateVm0007ManualReview(manualReview, changedRuleIds);
const reviewById = new Map(manualReview.reviews.map((review: any) => [review.stableRuleId, review]));
const truthById = new Map(truth.rows.map((row: any) => [row.ruleId, row]));
const baselineById = new Map(baselineProposal.rows.map((row: any) => [row.stableRuleId, row]));
const postById = new Map(proposal.rows.map((row: any) => [row.stableRuleId, row]));
const baselineEvidenceById = new Map(baselineEvidence.rows.map((row) => [row.stableRuleId, row]));
const postFixEvidenceById = new Map(postFixEvidence.rows.map((row) => [row.stableRuleId, row]));
const evidence = (row: any, field: string) => row?.[field] ?? [];
const sourceBacked = (records: any[]) => records.map((record) => {
  const quote = String(record.quote ?? "");
  const pages = extraction.pages.filter((page: any) => page.text.includes(quote)).map((page: any) => page.pageNumber);
  return { spanId: record.provenance?.spanId ?? record.spanId ?? null, page: record.provenance?.page ?? record.page ?? null, referencedPages: pages, documentContainsQuote: extraction.text.includes(quote) };
});
const changeAudit = changedRuleIds.map((stableRuleId: string) => {
  const before = baselineById.get(stableRuleId), after = postById.get(stableRuleId), reviewed = truthById.get(stableRuleId);
  const beforeBenchmark = baselineEvidenceById.get(stableRuleId)!, afterBenchmark = postFixEvidenceById.get(stableRuleId)!;
  const beforeAccepted = evidence(before, "acceptedEvidence"), afterAccepted = evidence(after, "acceptedEvidence"), reviewedAccepted = evidence(reviewed, "acceptedEvidence");
  const beforeRejected = evidence(before, "rejectedEvidence"), afterRejected = evidence(after, "rejectedEvidence"), reviewedRejected = evidence(reviewed, "rejectedEvidence");
  const beforeKeys = new Set(beforeAccepted.map((item: any) => canonicalJsonStringify(item))), afterKeys = new Set(afterAccepted.map((item: any) => canonicalJsonStringify(item)));
  const evidenceAdded = afterAccepted.filter((item: any) => !beforeKeys.has(canonicalJsonStringify(item))), evidenceRemoved = beforeAccepted.filter((item: any) => !afterKeys.has(canonicalJsonStringify(item)));
  const baselineFalseSupport = new Set(beforeBenchmark.accepted.falsePositiveRecords.map((item) => canonicalJsonStringify(item)));
  const removedFalseSupport = removedEvidenceIsBaselineFalseSupport(evidenceRemoved, baselineFalseSupport);
  const review = reviewById.get(stableRuleId)!;
  return { stableRuleId, serializedRowChanged: serializedRowChangedRuleIds.includes(stableRuleId), acceptedEvidenceMissDiagnosticChanged: acceptedEvidenceMissDiagnosticChangedRuleIds.includes(stableRuleId), baselineStatus: before.upstreamStatus, postFixStatus: after.upstreamStatus, reviewedStatus: reviewed.finalEvidenceState, baselineAcceptedEvidence: beforeAccepted, postFixAcceptedEvidence: afterAccepted, reviewedAcceptedEvidence: reviewedAccepted, baselineRejectedEvidence: beforeRejected, postFixRejectedEvidence: afterRejected, evidenceAdded, evidenceRemoved, sourceBackedExtraction: { baseline: sourceBacked(beforeAccepted), postFix: sourceBacked(afterAccepted), reviewed: sourceBacked(reviewedAccepted) }, provenanceChanges: { accepted: beforeAccepted.length !== afterAccepted.length || canonicalJsonStringify(beforeAccepted) !== canonicalJsonStringify(afterAccepted) }, findingActionChanges: { draftFinding: before.draftFindingCandidate !== after.draftFindingCandidate, clientAction: before.clientAction !== after.clientAction }, classification: review.classification, rationale: review.rationale, automatedEvidenceSummary: { removedFalseSupport, falseSupportBefore: beforeBenchmark.accepted.falsePositiveRecords.length, falseSupportAfter: afterBenchmark.accepted.falsePositiveRecords.length, missesBefore: beforeBenchmark.accepted.falseNegativeRecords.length, missesAfter: afterBenchmark.accepted.falseNegativeRecords.length } };
});
const regressions = Object.entries(metrics).filter(([, value]) => value.direction === "regressed").map(([name]) => name);
const improvements = Object.entries(metrics).filter(([, value]) => value.direction === "improved").map(([name]) => name);
const unchangedMetrics = Object.entries(metrics).filter(([, value]) => value.direction === "unchanged").map(([name]) => name);
const gateChecks = { frozenIdentities: true, uniqueRuleCount: stableRuleIds.length === 58, allChangedRulesManuallyClassified: changeAudit.length === changedRuleIds.length && changeAudit.every((item) => (VM0007_REVIEW_CLASSIFICATIONS as readonly string[]).includes(item.classification) && item.rationale.trim().length > 0), noManualRegressionOrFollowUp: changeAudit.every((item) => item.classification === "intended_improvement" || item.classification === "neutral_representation_change"), acceptedEvidenceFalseSupportImproves: metrics.acceptedEvidenceFalseSupport.direction === "improved", acceptedEvidenceMissedDoesNotIncrease: metrics.acceptedEvidenceMissed.direction !== "regressed", evidenceStateFailuresDoNotIncrease: metrics.evidenceStateFailures.direction !== "regressed", applicabilityFailuresDoNotIncrease: metrics.applicabilityFailures.direction !== "regressed", reviewerOutcomeFailuresDoNotIncrease: metrics.reviewerOutcomeFailures.direction !== "regressed", contradictionFailuresDoNotIncrease: metrics.contradictionFailures.direction !== "regressed", draftFindingFailuresDoNotIncrease: metrics.draftFindingFailures.direction !== "regressed", clientActionFailuresDoNotIncrease: metrics.clientActionFailures.direction !== "regressed", reviewedEvidenceFixtureUnchanged: sha256Bytes(files.truth) === expectedHashes.truth, frozenBaselineUnchanged: sha256Bytes(files.baseline) === expectedHashes.baseline };
const gateResult = Object.values(gateChecks).every(Boolean) ? "passed" : "failed";
const postFixProposalPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_PROPOSAL.json");
write(postFixProposalPath, proposalSerialized);
const benchmark = { schemaVersion: "vm0007-rc3-audited-post-fix-benchmark-v4", baselineIdentity: { path: relative(files.baseline), sha256: expectedHashes.baseline, proposalPath: relative(files.baselineProposal), proposalSha256: expectedHashes.baselineProposal, auditExecutionSha256: expectedHashes.preFixAuditExecution, diagnosticPath: relative(files.diagnostic), diagnosticSha256: expectedHashes.diagnostic }, reviewedTruthIdentity: { path: relative(files.truth), sha256: expectedHashes.truth }, extractionIdentity: { path: relative(files.extraction), sha256: expectedHashes.extraction }, manualReviewIdentity: { path: relative(files.manualReview), sha256: sha256Bytes(files.manualReview) }, postFixProposalIdentity: { path: relative(postFixProposalPath), sha256: sha256Text(proposalSerialized) }, postFixAuditExecutionSha256: auditExecutionSha256, ruleCount: 58, stableRuleIds: [...stableRuleIds].sort(), baselineMetrics: metricsFrom(baselineEvidence, baselineCategorical), postFixMetrics: metricsFrom(postFixEvidence, postFixCategorical), metricDeltas: metrics, improvements, regressions, unchangedMetrics, serializedRowChangedRuleIds, acceptedEvidenceMissDiagnosticChangedRuleIds, acceptedEvidenceMissDiagnosticChangedRuleCount: acceptedEvidenceMissDiagnosticChangedRuleIds.length, changedRuleIds, changedRuleCount: changedRuleIds.length, gateResult };
function metricsFrom(e: ReturnType<typeof evaluateVm0007EvidenceBenchmark>, c: ReturnType<typeof evaluateVm0007Benchmark>) { return { acceptedEvidenceFalseSupport: e.aggregate.accepted.falsePositiveCount, acceptedEvidenceMissed: e.aggregate.accepted.falseNegativeCount, evidenceStateFailures: c.aggregate.fields.evidenceState.mismatchedCount, applicabilityFailures: c.aggregate.fields.applicability.mismatchedCount, reviewerOutcomeFailures: c.aggregate.fields.reviewerOutcome.mismatchedCount, contradictionFailures: c.aggregate.fields.contradictionState.mismatchedCount, draftFindingFailures: c.aggregate.fields.draftFinding.mismatchedCount, clientActionFailures: c.aggregate.fields.clientAction.mismatchedCount, acceptedEvidencePrecision: e.aggregate.accepted.precision, acceptedEvidenceRecall: e.aggregate.accepted.recall, acceptedEvidenceF1: e.aggregate.accepted.f1 }; }
const changeAuditPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_CHANGE_AUDIT.json");
write(changeAuditPath, `${canonicalJsonStringify({ schemaVersion: "vm0007-rc3-audited-post-fix-change-audit-v3", manualReview: false, manualReviewInput: { path: relative(files.manualReview), sha256: sha256Bytes(files.manualReview) }, changedRuleCount: changeAudit.length, rules: changeAudit })}\n`);
const manifestPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_MANIFEST.json");
const benchmarkPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.json");
write(benchmarkPath, `${canonicalJsonStringify(benchmark)}\n`);
const reportPath = path.join(artifactDir, "RC3_AUDITED_POST_FIX_BENCHMARK.md");
const report = `# RC3 audited post-fix benchmark\n\n- Frozen baseline: \`${relative(files.baseline)}\` (${expectedHashes.baseline})\n- Frozen pre-fix proposal: \`${relative(files.baselineProposal)}\` (${expectedHashes.baselineProposal})\n- Reviewed truth: \`${relative(files.truth)}\` (${expectedHashes.truth})\n- Raw extraction: \`${relative(files.extraction)}\` (${expectedHashes.extraction})\n- Frozen pre-fix diagnostic: \`${relative(files.diagnostic)}\` (${expectedHashes.diagnostic})\n- Human review input: \`${relative(files.manualReview)}\` (${sha256Bytes(files.manualReview)})\n- Post-fix audit execution: ${auditExecutionSha256}\n\n| Metric | Before | After | Delta |\n| --- | ---: | ---: | ---: |\n${Object.entries(metrics).map(([name, value]) => `| ${name} | ${String(value.baseline)} | ${String(value.postFix)} | ${String(value.delta)} |`).join("\n")}\n\nSerialized-row changes: ${serializedRowChangedRuleIds.length}. Accepted-evidence-miss diagnostic changes: ${acceptedEvidenceMissDiagnosticChangedRuleIds.length}. Changed rules reviewed from authored input: ${changeAudit.length}. Improvements: ${improvements.length ? improvements.join(", ") : "none"}. Regressions: ${regressions.length ? regressions.join(", ") : "none"}. Phase 3 gate: **${gateResult}**.\n\nNo production logic or reviewed/frozen artifact was changed by this benchmark.\n`;
write(reportPath, report);
const artifactPaths = [postFixProposalPath, benchmarkPath, changeAuditPath, reportPath];
const manifest = { schemaVersion: "vm0007-rc3-audited-post-fix-manifest-v4", command: "npm run preverif:rc3:post-fix-benchmark", inputs: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, { path: relative(file), sha256: name === "baseline" ? expectedHashes.baseline : name === "baselineProposal" ? expectedHashes.baselineProposal : name === "truth" ? expectedHashes.truth : name === "extraction" ? expectedHashes.extraction : name === "diagnostic" ? expectedHashes.diagnostic : sha256Bytes(file) }])), artifacts: Object.fromEntries(artifactPaths.map((file) => [relative(file), { sha256: sha256Bytes(file) }])), manualReview: { path: relative(files.manualReview), sha256: sha256Bytes(files.manualReview) }, preFixDiagnostic: { path: relative(files.diagnostic), sha256: expectedHashes.diagnostic }, postFixAuditExecutionSha256: auditExecutionSha256, ruleCount: 58, serializedRowChangedRuleCount: serializedRowChangedRuleIds.length, acceptedEvidenceMissDiagnosticChangedRuleCount: acceptedEvidenceMissDiagnosticChangedRuleIds.length, changedRuleCount: changeAudit.length, gateResult };
write(manifestPath, `${canonicalJsonStringify(manifest)}\n`);
console.log(`Wrote RC3 post-fix benchmark: ${changeAudit.length} changed rules; gate=${gateResult}; false-support ${metrics.acceptedEvidenceFalseSupport.baseline} -> ${metrics.acceptedEvidenceFalseSupport.postFix}.`);
