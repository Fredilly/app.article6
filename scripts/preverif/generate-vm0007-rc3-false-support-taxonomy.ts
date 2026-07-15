import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { canonicalJsonStringify } from "../../src/lib/export/canonicalJson";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { type Vm0007EvidenceBenchmarkMachineRow, type Vm0007EvidenceBenchmarkReviewedRow } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { assertAuditedV2Identities, AUDITED_V2_IDENTITIES, buildVm0007Rc3FalseSupportTaxonomy, serializeVm0007Rc3FalseSupportTaxonomy } from "../../src/lib/preverif/vm0007Rc3FalseSupportTaxonomy";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const richRulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.json");
const extractionPath = path.join(fixtureDir, "raw-document-extraction.json");
const auditedBaselinePath = path.join(artifactDir, "RC3_AUDITED_PRE_FIX_BASELINE.json");
const auditedProposalPath = path.join(artifactDir, "RC3_AUDITED_PRE_FIX_PROPOSAL.json");
const outputPath = path.join(artifactDir, "RC3_FALSE_SUPPORT_TAXONOMY.json");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8")) as any;
const digest = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const machine = read(machinePath);
const reviewed = read(reviewedPath);
const extraction = read(extractionPath);
const auditedBaseline = read(auditedBaselinePath);
const auditedProposalBytes = fs.readFileSync(auditedProposalPath, "utf8");
const auditedTruthSha256 = digest(reviewedPath);
const sourceExtractionSha256 = digest(extractionPath);
const auditedBaselineSha256 = digest(auditedBaselinePath);
if (auditedTruthSha256 !== AUDITED_V2_IDENTITIES.reviewedTruthSha256) throw new Error("False-support taxonomy requires audited V2 reviewed truth");
if (sourceExtractionSha256 !== AUDITED_V2_IDENTITIES.sourceExtractionSha256) throw new Error("False-support taxonomy source extraction identity changed");
if (auditedBaselineSha256 !== AUDITED_V2_IDENTITIES.auditedBaselineSha256) throw new Error("Audited V2 baseline identity changed");
if (auditedBaseline.truth?.sha256 !== AUDITED_V2_IDENTITIES.reviewedTruthSha256 || auditedBaseline.generatedProposal?.sha256 !== AUDITED_V2_IDENTITIES.generatedProposalSha256 || auditedBaseline.productionExecution?.auditExecutionSha256 !== AUDITED_V2_IDENTITIES.productionExecutionSha256) throw new Error("Audited V2 baseline manifest identities do not match");
const rules = read(richRulesPath).map((rule: Record<string, unknown>) => ({
  id: String(rule.id), title: String(rule.title ?? ""), summary: String(rule.summary ?? ""), logic: String(rule.logic ?? ""), text: String(rule.text ?? ""), type: String(rule.type ?? ""),
}));
const expectedStableRuleIds = read(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.json")).rules.map((rule: { stable_id: string }) => rule.stable_id);
const context = getStructuredQueryContext(extraction.text);
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
  auditId: "rc3-audited-pre-fix-baseline-marcondes-vm0007-v18",
  generatedAt: "1970-01-01T00:00:00.000Z",
  rules: rules.map((rule: any) => ({ ...rule, snippet: rule.text, tags: [] })),
  audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: machine.sourceDocument.contentSha256 },
});
if (!draft.ok) throw new Error(`False-support taxonomy draft build blocked: ${draft.blockedBy.join(", ")}`);
const serializedProposal = canonicalJsonStringify(draft.package);
if (serializedProposal !== auditedProposalBytes) throw new Error("Generated audited V2 proposal differs from frozen audited proposal");
if (digest(auditedProposalPath) !== AUDITED_V2_IDENTITIES.generatedProposalSha256) throw new Error("Audited V2 proposal identity changed");
const reloadedProposal = JSON.parse(serializedProposal) as typeof draft.package;
if (reloadedProposal.rows.length !== 58) throw new Error("False-support taxonomy proposal does not contain all 58 rules");
const taxonomy = buildVm0007Rc3FalseSupportTaxonomy({
  currentRows: reloadedProposal.rows as unknown as Vm0007EvidenceBenchmarkMachineRow[],
  reviewedRows: reviewed.rows as Vm0007EvidenceBenchmarkReviewedRow[],
  expectedStableRuleIds,
  audit,
  draft: draft.package,
  reloadedDraft: reloadedProposal,
});
const auditExecutionSha256 = crypto.createHash("sha256").update(canonicalJsonStringify(audit), "utf8").digest("hex");
assertAuditedV2Identities({ reviewedTruthSha256: auditedTruthSha256, sourceExtractionSha256, productionExecutionSha256: auditExecutionSha256, generatedProposalSha256: digest(auditedProposalPath), auditedBaselineSha256 });
const artifact = {
  ...taxonomy,
  source: {
    currentProposalKind: "same_run_serialized_reload",
    generatedProposalSha256: AUDITED_V2_IDENTITIES.generatedProposalSha256,
    auditExecutionSha256,
    sourceExtractionSha256,
    frozenRc2BaselineSha256: auditedBaselineSha256,
    reviewedTruthSha256: auditedTruthSha256,
    machineProposalFrozenSha256: digest(machinePath),
  },
  fixtureProtection: { reviewedTruthUnchanged: true, machineProposalUnchanged: true, rc2BaselineUnchanged: true },
};
fs.writeFileSync(outputPath, `${canonicalJsonStringify(artifact)}\n`, "utf8");
console.log(`Wrote false-support taxonomy: ${taxonomy.totalEvents} events; ${taxonomy.affectedRuleCount} rules.`);
