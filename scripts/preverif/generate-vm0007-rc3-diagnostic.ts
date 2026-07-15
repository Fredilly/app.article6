import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { evaluateVm0007EvidenceBenchmark, type Vm0007EvidenceBenchmarkMachineRow, type Vm0007EvidenceBenchmarkReviewedRow } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { buildVm0007Rc3Diagnostic, serializeVm0007Rc3Diagnostic } from "../../src/lib/preverif/vm0007Rc3Diagnostic";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { buildVm0007Rc2Baseline, serializeVm0007Rc2Baseline } from "../../src/lib/preverif/vm0007Rc2Baseline";

const root = process.cwd();
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const digest = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.rc2-rc3.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");
const baselinePath = path.join(artifactDir, "RC2_BASELINE.json");
const extractionPath = path.join(fixtureDir, "raw-document-extraction.json");
const machine = read(machinePath); const reviewed = read(reviewedPath); const registry = read(registryPath);
const baselineInput = { machineRows: machine.rows, reviewedRows: reviewed.rows, expectedStableRuleIds: registry.rules.map((rule: { stable_id: string }) => rule.stable_id), reconciliationRows: read(reconciliationPath).rows, fixtureIdentity: { machineProposal: { path: path.relative(root, machinePath), sha256: digest(machinePath) }, reviewedTruth: { path: path.relative(root, path.join(fixtureDir, "gold.json")), sha256: digest(reviewedPath) }, stableRuleRegistry: { path: path.relative(root, registryPath), sha256: digest(registryPath) }, reconciliation: { path: path.relative(root, reconciliationPath), sha256: digest(reconciliationPath) } } };
const baseline = buildVm0007Rc2Baseline(baselineInput);
if (serializeVm0007Rc2Baseline(baseline) !== fs.readFileSync(baselinePath, "utf8")) throw new Error("Frozen RC2 baseline is not reproducible; refusing to generate RC3 diagnostic");
const extraction = read(extractionPath);
const context = getStructuredQueryContext(extraction.text);
const traceAudit = auditEvidence({
  rules: (read(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json")) as Array<Record<string, unknown>>).map((rule) => ({ id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""), text: String(rule.text ?? ""), type: String(rule.type ?? "") })),
  evidenceDocument: context.evidenceDocument,
  getContract: getVm0007EvidenceContract,
  normalizeRuleId: normalizeVm0007RuleId,
  sections: context.documentStructure.sections,
  rawText: extraction.text,
  diagnosticTrace: true,
  versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
});
const diagnostic = buildVm0007Rc3Diagnostic({ benchmark: evaluateVm0007EvidenceBenchmark({ machineRows: machine.rows as Vm0007EvidenceBenchmarkMachineRow[], reviewedRows: reviewed.rows as Vm0007EvidenceBenchmarkReviewedRow[], expectedStableRuleIds: baseline.stableRuleIds }), machineRows: machine.rows, reviewedRows: reviewed.rows, diagnosticTrace: traceAudit.diagnosticTrace, sourceCorpus: { documentId: extraction.sourceDocument?.documentId ?? "quick-check-review-question", documentSha256: machine.sourceDocument?.contentSha256 ?? "", extractionPath: path.relative(root, extractionPath), text: extraction.text }, baseline: { artifactPath: path.relative(root, baselinePath), artifactSha256: digest(baselinePath) } });
fs.writeFileSync(path.join(artifactDir, "RC3_DIAGNOSTIC.json"), serializeVm0007Rc3Diagnostic(diagnostic), "utf8");
console.log(`Wrote RC3 diagnostic: ${diagnostic.totals.classified} events; ${diagnostic.totals.categoryCounts.selected_but_match_failed} selected-but-match-failed.`);
