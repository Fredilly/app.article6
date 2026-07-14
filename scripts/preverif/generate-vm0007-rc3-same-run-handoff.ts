import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { buildVm0007Rc3Diagnostic } from "../../src/lib/preverif/vm0007Rc3Diagnostic";
import { buildVm0007Rc2Baseline } from "../../src/lib/preverif/vm0007Rc2Baseline";
import { evaluateVm0007EvidenceBenchmark } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { buildVm0007Rc3SameRunHandoffTrace, serializeVm0007Rc3SameRunHandoffTrace } from "../../src/lib/preverif/vm0007Rc3SameRunHandoffTrace";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const rulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
const registryPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.json");
const extractionPath = path.join(fixtureDir, "raw-document-extraction.json");
const reconciliationPath = path.join(fixtureDir, "mismatch-reconciliation.json");
const baselinePath = path.join(artifactDir, "RC2_BASELINE.json");
const frozenProposalPath = machinePath;
const outputPath = path.join(artifactDir, "RC3_SAME_RUN_HANDOFF_TRACE.json");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8")) as any;
const sha256 = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const machine = read(machinePath);
const reviewed = read(reviewedPath);
const registry = read(registryPath);
const extraction = read(extractionPath);
const baseline = buildVm0007Rc2Baseline({
  machineRows: machine.rows,
  reviewedRows: reviewed.rows,
  expectedStableRuleIds: registry.rules.map((rule: { stable_id: string }) => rule.stable_id),
  reconciliationRows: read(reconciliationPath).rows,
  fixtureIdentity: {
    machineProposal: { path: path.relative(root, machinePath), sha256: sha256(machinePath) },
    reviewedTruth: { path: path.relative(root, reviewedPath), sha256: sha256(reviewedPath) },
    stableRuleRegistry: { path: path.relative(root, registryPath), sha256: sha256(registryPath) },
    reconciliation: { path: path.relative(root, reconciliationPath), sha256: sha256(reconciliationPath) },
  },
});
const context = getStructuredQueryContext(extraction.text);
const rules = read(rulesPath).map((rule: Record<string, unknown>) => ({
  id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""),
  text: String(rule.text ?? ""), type: String(rule.type ?? ""), snippet: String(rule.snippet ?? rule.text ?? ""), tags: [],
}));
const audit = auditEvidence({
  rules: rules.map((rule: any) => ({ id: rule.id, title: rule.title, summary: rule.summary, logic: rule.logic, text: rule.text, type: rule.type })),
  evidenceDocument: context.evidenceDocument,
  getContract: getVm0007EvidenceContract,
  normalizeRuleId: normalizeVm0007RuleId,
  sections: context.documentStructure.sections,
  rawText: extraction.text,
  diagnosticTrace: true,
  versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
});
const benchmark = evaluateVm0007EvidenceBenchmark({ machineRows: machine.rows, reviewedRows: reviewed.rows, expectedStableRuleIds: baseline.stableRuleIds });
const diagnostic = buildVm0007Rc3Diagnostic({
  benchmark, machineRows: machine.rows, reviewedRows: reviewed.rows, diagnosticTrace: audit.diagnosticTrace,
  sourceCorpus: { documentId: extraction.sourceDocument?.documentId ?? context.evidenceDocument.docId, documentSha256: machine.sourceDocument.contentSha256, extractionPath: path.relative(root, extractionPath), text: extraction.text },
  baseline: { artifactPath: path.relative(root, baselinePath), artifactSha256: sha256(baselinePath) },
});
const selectedEvents = diagnostic.events.filter((event) => event.primaryCause === "selected_but_match_failed");
const draftResult = buildVm0007EvidenceMapDraft({
  auditId: "rc3-same-run-audit-marcondes-vm0007-v18",
  generatedAt: "1970-01-01T00:00:00.000Z",
  rules,
  audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: machine.sourceDocument.contentSha256 },
});
if (!draftResult.ok) throw new Error(`Same-run draft build blocked: ${draftResult.blockedBy.join(", ")}`);
const serializedProposal = JSON.stringify(draftResult.package);
const reloadedProposal = JSON.parse(serializedProposal);
const reviewedById = new Map(reviewed.rows.map((row: any) => [row.ruleId, row]));
const proposalById = new Map(reloadedProposal.rows.map((row: any) => [row.stableRuleId, row]));
const duplicateCardinalityEventIds = new Set<string>();
for (const event of selectedEvents) {
  const reviewedRow = reviewedById.get(event.stableRuleId);
  const proposalRow = proposalById.get(event.stableRuleId);
  const reviewedMatches = Array.isArray(reviewedRow?.acceptedEvidence) ? reviewedRow.acceptedEvidence.filter((record: any) => normalizeVm0007RuleId(event.stableRuleId) && String(record.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() === String(event.reviewedEvidence.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()) : [];
  const proposalMatches = Array.isArray(proposalRow?.acceptedEvidence) ? proposalRow.acceptedEvidence.filter((record: any) => String(record.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() === String(event.reviewedEvidence.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()) : [];
  const reviewedDuplicates = reviewedMatches.length > new Set(reviewedMatches.map((record: any) => String(record.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim())).size;
  const proposalDuplicates = proposalMatches.length > new Set(proposalMatches.map((record: any) => String(record.quote).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim())).size;
  if (reviewedMatches.length !== proposalMatches.length && (reviewedDuplicates || proposalDuplicates)) duplicateCardinalityEventIds.add(event.eventId);
}
const trace = buildVm0007Rc3SameRunHandoffTrace({
  diagnosticEvents: selectedEvents,
  audit,
  draft: draftResult.package,
  reloadedProposal,
  duplicateCardinalityEventIds,
  inputDocumentSha256: machine.sourceDocument.contentSha256,
  frozenRc2Baseline: { path: path.relative(root, baselinePath), sha256: sha256(baselinePath) },
  frozenProposal: { path: path.relative(root, frozenProposalPath), sha256: sha256(frozenProposalPath) },
});
fs.writeFileSync(outputPath, serializeVm0007Rc3SameRunHandoffTrace(trace), "utf8");
console.log(`Wrote same-run handoff trace: ${trace.parentEventCount} events; ${trace.generatedProposalSha256}; highest=${Object.entries(trace.primaryStageCounts).sort((left, right) => right[1] - left[1])[0]?.[0]}.`);
