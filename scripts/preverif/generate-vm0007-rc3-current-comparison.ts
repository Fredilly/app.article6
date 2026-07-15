import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { buildVm0007Rc2Baseline, serializeVm0007Rc2Baseline } from "../../src/lib/preverif/vm0007Rc2Baseline";
import { evaluateVm0007EvidenceBenchmark, type Vm0007EvidenceBenchmarkMachineRow, type Vm0007EvidenceBenchmarkReviewedRow } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { assertFrozenRc2Baseline, buildVm0007Rc3CurrentComparison, serializeVm0007Rc3CurrentComparison } from "../../src/lib/preverif/vm0007Rc3CurrentComparison";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const rulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const richRulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.rc2-rc3.json");
const extractionPath = path.join(fixtureDir, "raw-document-extraction.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");
const baselinePath = path.join(artifactDir, "RC2_BASELINE.json");
const outputPath = path.join(artifactDir, "RC3_CURRENT_COMPARISON.json");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8")) as any;
const digest = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const machine = read(machinePath);
const reviewed = read(reviewedPath);
const registry = read(rulesPath);
const extraction = read(extractionPath);
const expectedStableRuleIds = registry.rules.map((rule: { stable_id: string }) => rule.stable_id);
const baselineInput = {
  machineRows: machine.rows,
  reviewedRows: reviewed.rows,
  expectedStableRuleIds,
  reconciliationRows: read(reconciliationPath).rows,
  fixtureIdentity: {
    machineProposal: { path: path.relative(root, machinePath), sha256: digest(machinePath) },
    reviewedTruth: { path: path.relative(root, path.join(fixtureDir, "gold.json")), sha256: digest(reviewedPath) },
    stableRuleRegistry: { path: path.relative(root, rulesPath), sha256: digest(rulesPath) },
    reconciliation: { path: path.relative(root, reconciliationPath), sha256: digest(reconciliationPath) },
  },
};
const baseline = buildVm0007Rc2Baseline(baselineInput);
const frozenBaselineBytes = fs.readFileSync(baselinePath, "utf8");
assertFrozenRc2Baseline({ committedSha256: digest(baselinePath), rebuiltSerialized: serializeVm0007Rc2Baseline(baseline), committedSerialized: frozenBaselineBytes });
const frozenBaseline = JSON.parse(frozenBaselineBytes) as typeof baseline;

const context = getStructuredQueryContext(extraction.text);
const rules = read(richRulesPath).map((rule: Record<string, unknown>) => ({
  id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""), text: String(rule.text ?? ""), type: String(rule.type ?? ""),
}));
const audit = auditEvidence({
  rules,
  evidenceDocument: context.evidenceDocument,
  getContract: getVm0007EvidenceContract,
  normalizeRuleId: normalizeVm0007RuleId,
  sections: context.documentStructure.sections,
  rawText: extraction.text,
  diagnosticTrace: true,
  versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
});
const draft = buildVm0007EvidenceMapDraft({
  auditId: "rc3-current-same-run-comparison-vm0007-v18",
  generatedAt: "1970-01-01T00:00:00.000Z",
  rules: rules.map((rule: any) => ({ ...rule, snippet: rule.text, tags: [] })),
  audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: machine.sourceDocument.contentSha256 },
});
if (!draft.ok) throw new Error(`Current same-run draft build blocked: ${draft.blockedBy.join(", ")}`);
const serializedProposal = JSON.stringify(draft.package);
const reloadedProposal = JSON.parse(serializedProposal) as typeof draft.package;
if (reloadedProposal.rows.length !== 58) throw new Error("Current same-run proposal does not contain all 58 rules");
const currentRows = reloadedProposal.rows as unknown as Vm0007EvidenceBenchmarkMachineRow[];
const reviewedRows = reviewed.rows as Vm0007EvidenceBenchmarkReviewedRow[];
const currentEvidence = evaluateVm0007EvidenceBenchmark({ machineRows: currentRows, reviewedRows, expectedStableRuleIds });
const traceAuditSha = crypto.createHash("sha256").update(JSON.stringify(audit), "utf8").digest("hex");
const comparison = buildVm0007Rc3CurrentComparison({
  currentRows,
  frozenRows: machine.rows as Vm0007EvidenceBenchmarkMachineRow[],
  reviewedRows,
  expectedStableRuleIds,
  frozenRc2: { path: path.relative(root, baselinePath), sha256: digest(baselinePath), baseline: frozenBaseline },
  frozenProposal: { path: path.relative(root, machinePath), sha256: digest(machinePath) },
  reviewedTruth: { path: path.relative(root, path.join(fixtureDir, "gold.json")), sha256: digest(reviewedPath) },
  currentProposal: { serialized: serializedProposal, auditExecutionSha256: traceAuditSha, sourceExtractionSha256: digest(extractionPath) },
  diagnosticTrace: audit.diagnosticTrace ?? [],
  frozenRc2Unchanged: digest(baselinePath) === "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf",
  frozenProposalUnchanged: digest(machinePath) === baseline.fixtureIdentity.machineProposal.sha256,
  reviewedTruthUnchanged: digest(reviewedPath) === baseline.fixtureIdentity.reviewedTruth.sha256,
});
if (currentEvidence.aggregate.accepted.falseNegativeCount < 0) throw new Error("Unreachable benchmark guard");
fs.writeFileSync(outputPath, serializeVm0007Rc3CurrentComparison(comparison), "utf8");
console.log(`Wrote current same-run comparison: ${comparison.ruleCount} rules; accepted misses=${comparison.metrics.acceptedEvidenceMissed.current}; false support=${comparison.metrics.acceptedEvidenceFalseSupport.current}.`);
