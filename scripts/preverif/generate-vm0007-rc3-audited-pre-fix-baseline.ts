import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJsonStringify } from "../../src/lib/export/canonicalJson";
import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { evaluateVm0007EvidenceBenchmark } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { buildVm0007Rc2Baseline, serializeVm0007Rc2Baseline } from "../../src/lib/preverif/vm0007Rc2Baseline";
import { buildVm0007Rc3Diagnostic, serializeVm0007Rc3Diagnostic } from "../../src/lib/preverif/vm0007Rc3Diagnostic";
import { buildVm0007Rc3SelectedMatchSubtaxonomy, serializeVm0007Rc3SelectedMatchSubtaxonomy } from "../../src/lib/preverif/vm0007Rc3SelectedMatchSubtaxonomy";
import { buildVm0007Rc3SameRunHandoffTrace, serializeVm0007Rc3SameRunHandoffTrace } from "../../src/lib/preverif/vm0007Rc3SameRunHandoffTrace";
import { buildVm0007Rc3CurrentComparison, serializeVm0007Rc3CurrentComparison } from "../../src/lib/preverif/vm0007Rc3CurrentComparison";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc3");
const fixturePath = (name: string) => path.join(fixtureDir, name);
const artifactPath = (name: string) => path.join(artifactDir, name);
const read = (filePath: string): any => JSON.parse(fs.readFileSync(filePath, "utf8"));
const sha256Bytes = (filePath: string): string => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const sha256Text = (value: string): string => crypto.createHash("sha256").update(value, "utf8").digest("hex");
const relative = (filePath: string) => path.relative(root, filePath);
const write = (filePath: string, value: string) => fs.writeFileSync(filePath, value, "utf8");

const machinePath = fixturePath("machine-proposal.json");
const auditedTruthPath = fixturePath("gold.json");
const extractionPath = fixturePath("raw-document-extraction.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const richRulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
const reconciliationPath = fixturePath("mismatch-reconciliation.json");
const machine = read(machinePath);
const auditedTruth = read(auditedTruthPath);
const extraction = read(extractionPath);
const registry = read(registryPath);
const context = getStructuredQueryContext(extraction.text);
const rules = read(richRulesPath).map((rule: Record<string, unknown>) => ({
  id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""),
  text: String(rule.text ?? ""), type: String(rule.type ?? ""), snippet: String(rule.snippet ?? rule.text ?? ""), tags: [],
}));
const expectedStableRuleIds = registry.rules.map((rule: { stable_id: string }) => rule.stable_id);

const baselineModel = buildVm0007Rc2Baseline({
  machineRows: machine.rows,
  reviewedRows: auditedTruth.rows,
  expectedStableRuleIds,
  reconciliationRows: read(reconciliationPath).rows,
  fixtureIdentity: {
    machineProposal: { path: relative(machinePath), sha256: sha256Bytes(machinePath) },
    reviewedTruth: { path: relative(auditedTruthPath), sha256: sha256Bytes(auditedTruthPath) },
    stableRuleRegistry: { path: relative(registryPath), sha256: sha256Bytes(registryPath) },
    reconciliation: { path: relative(reconciliationPath), sha256: sha256Bytes(reconciliationPath) },
  },
});
if (baselineModel.totalRowCount !== 58) throw new Error(`Audited baseline requires 58 rows; received ${baselineModel.totalRowCount}`);

const audit = auditEvidence({
  rules: rules.map(({ id, title, summary, logic, text, type }: any) => ({ id, title, summary, logic, text, type })),
  evidenceDocument: context.evidenceDocument,
  getContract: getVm0007EvidenceContract,
  normalizeRuleId: normalizeVm0007RuleId,
  sections: context.documentStructure.sections,
  rawText: extraction.text,
  diagnosticTrace: true,
  versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
});
const auditExecutionSha256 = sha256Text(canonicalJsonStringify(audit));
const draftResult = buildVm0007EvidenceMapDraft({
  auditId: "rc3-audited-pre-fix-baseline-marcondes-vm0007-v18",
  generatedAt: "1970-01-01T00:00:00.000Z",
  rules,
  audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: machine.sourceDocument.contentSha256 },
});
if (!draftResult.ok) throw new Error(`Audited pre-fix proposal blocked: ${draftResult.blockedBy.join(", ")}`);
const generatedProposalSerialized = canonicalJsonStringify(draftResult.package);
const generatedProposalSha256 = sha256Text(generatedProposalSerialized);
const generatedProposalFile = artifactPath("RC3_AUDITED_PRE_FIX_PROPOSAL.json");
write(generatedProposalFile, generatedProposalSerialized);
if (sha256Bytes(generatedProposalFile) !== generatedProposalSha256) throw new Error("Generated proposal artifact SHA does not match its serialized proposal");
const reloadedProposal = JSON.parse(generatedProposalSerialized);
const benchmark = evaluateVm0007EvidenceBenchmark({ machineRows: reloadedProposal.rows, reviewedRows: auditedTruth.rows, expectedStableRuleIds });

const baselineFile = artifactPath("RC3_AUDITED_PRE_FIX_BASELINE.json");
const baselinePayload = {
  schemaVersion: "vm0007-rc3-audited-pre-fix-baseline-v1",
  truth: { path: relative(auditedTruthPath), sha256: sha256Bytes(auditedTruthPath), rowCount: auditedTruth.rows.length },
  extraction: { path: relative(extractionPath), sha256: sha256Bytes(extractionPath) },
  productionExecution: { auditExecutionSha256 },
  generatedProposal: { path: relative(generatedProposalFile), sha256: generatedProposalSha256 },
  baseline: baselineModel,
};
write(baselineFile, `${canonicalJsonStringify(baselinePayload)}\n`);
const baselineSha256 = sha256Bytes(baselineFile);
const baselineRef = { artifactPath: relative(baselineFile), artifactSha256: baselineSha256 };

const diagnostic = buildVm0007Rc3Diagnostic({
  benchmark,
  machineRows: reloadedProposal.rows,
  reviewedRows: auditedTruth.rows,
  diagnosticTrace: audit.diagnosticTrace,
  sourceCorpus: { documentId: extraction.sourceDocument?.documentId ?? context.evidenceDocument.docId, documentSha256: machine.sourceDocument.contentSha256, extractionPath: relative(extractionPath), text: extraction.text },
  baseline: baselineRef,
});
const diagnosticFile = artifactPath("RC3_AUDITED_DIAGNOSTIC.json");
write(diagnosticFile, serializeVm0007Rc3Diagnostic(diagnostic));

const selectedMatch = buildVm0007Rc3SelectedMatchSubtaxonomy({ diagnostic, machineRows: reloadedProposal.rows, reviewedRows: auditedTruth.rows, baseline: baselineRef });
const selectedMatchFile = artifactPath("RC3_AUDITED_SELECTED_MATCH_SUBTAXONOMY.json");
write(selectedMatchFile, serializeVm0007Rc3SelectedMatchSubtaxonomy(selectedMatch));

const selectedEvents = diagnostic.events.filter((event) => event.primaryCause === "selected_but_match_failed");
const proposalById = new Map(reloadedProposal.rows.map((row: any) => [row.stableRuleId, row]));
const auditedById = new Map(auditedTruth.rows.map((row: any) => [row.ruleId, row]));
const duplicateCardinalityEventIds = new Set<string>();
for (const event of selectedEvents) {
  const reviewed = auditedById.get(event.stableRuleId);
  const proposed = proposalById.get(event.stableRuleId);
  const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const reviewedMatches = (reviewed?.acceptedEvidence ?? []).filter((record: any) => normalized(record.quote) === normalized(event.reviewedEvidence.quote));
  const proposedMatches = (proposed?.acceptedEvidence ?? []).filter((record: any) => normalized(record.quote) === normalized(event.reviewedEvidence.quote));
  const hasDuplicates = (records: any[]) => records.length > new Set(records.map((record) => normalized(record.quote))).size;
  if (reviewedMatches.length !== proposedMatches.length && (hasDuplicates(reviewedMatches) || hasDuplicates(proposedMatches))) duplicateCardinalityEventIds.add(event.eventId);
}
const handoff = buildVm0007Rc3SameRunHandoffTrace({
  diagnosticEvents: selectedEvents,
  audit,
  draft: draftResult.package,
  reloadedProposal,
  duplicateCardinalityEventIds,
  inputDocumentSha256: machine.sourceDocument.contentSha256,
  frozenRc2Baseline: baselineRef,
  frozenProposal: { path: relative(machinePath), sha256: sha256Bytes(machinePath) },
});
const handoffFile = artifactPath("RC3_AUDITED_SAME_RUN_HANDOFF_TRACE.json");
write(handoffFile, serializeVm0007Rc3SameRunHandoffTrace(handoff));

const comparison = buildVm0007Rc3CurrentComparison({
  currentRows: reloadedProposal.rows,
  frozenRows: machine.rows,
  reviewedRows: auditedTruth.rows,
  expectedStableRuleIds,
  frozenRc2: { path: relative(baselineFile), sha256: baselineSha256, baseline: baselineModel },
  frozenProposal: { path: relative(machinePath), sha256: sha256Bytes(machinePath) },
  reviewedTruth: { path: relative(auditedTruthPath), sha256: sha256Bytes(auditedTruthPath) },
  currentProposal: { serialized: generatedProposalSerialized, auditExecutionSha256, sourceExtractionSha256: sha256Bytes(extractionPath) },
  diagnosticTrace: audit.diagnosticTrace ?? [],
  frozenRc2Unchanged: true,
  frozenProposalUnchanged: true,
  reviewedTruthUnchanged: true,
});
const comparisonFile = artifactPath("RC3_AUDITED_CURRENT_COMPARISON.json");
write(comparisonFile, serializeVm0007Rc3CurrentComparison(comparison));

const files = [baselineFile, generatedProposalFile, diagnosticFile, selectedMatchFile, handoffFile, comparisonFile];
const manifest = {
  schemaVersion: "vm0007-rc3-audited-pre-fix-baseline-manifest-v1",
  auditedTruth: { path: relative(auditedTruthPath), sha256: sha256Bytes(auditedTruthPath) },
  extraction: { path: relative(extractionPath), sha256: sha256Bytes(extractionPath) },
  productionExecution: { auditExecutionSha256 },
  generatedProposal: { path: relative(generatedProposalFile), sha256: sha256Bytes(generatedProposalFile) },
  artifacts: Object.fromEntries(files.map((file) => [relative(file), { sha256: sha256Bytes(file) }])),
  counts: {
    ruleCount: baselineModel.totalRowCount,
    acceptedEvidenceMissed: diagnostic.totals.acceptedEvidenceMissed,
    acceptedEvidenceFalseSupport: diagnostic.baseline.acceptedEvidenceFalseSupport,
    acceptedEvidenceMissCategories: diagnostic.totals.categoryCounts,
    selectedButMatchFailed: selectedMatch.parentCategory.count,
    selectedMatchSubtypes: selectedMatch.subtypeCounts,
    handoffPrimaryStages: handoff.primaryStageCounts,
    comparisonMetrics: Object.fromEntries(Object.entries(comparison.metrics).map(([name, value]) => [name, { current: value.current, frozenRc2: value.frozenRc2, delta: value.delta }])),
  },
  reproduction: {
    command: "npm run preverif:rc3:audited-pre-fix-baseline",
    inputs: [relative(auditedTruthPath), relative(extractionPath), relative(machinePath), relative(registryPath), relative(richRulesPath), relative(reconciliationPath)],
    productionPath: "auditEvidence → buildVm0007EvidenceMapDraft → serialized reload",
  },
};
write(artifactPath("RC3_AUDITED_PRE_FIX_BASELINE_MANIFEST.json"), `${canonicalJsonStringify(manifest)}\n`);
console.log(`Wrote audited RC3 pre-fix baseline: ${baselineModel.totalRowCount} rows; misses=${diagnostic.totals.acceptedEvidenceMissed}; selected-match=${selectedMatch.parentCategory.count}.`);
