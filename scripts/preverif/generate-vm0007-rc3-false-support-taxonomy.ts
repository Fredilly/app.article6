import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getStructuredQueryContext } from "../../src/lib/chat/quickCheckReviewQuestion";
import { canonicalJsonStringify } from "../../src/lib/export/canonicalJson";
import { auditEvidence } from "../../src/lib/preverif/evidenceAudit";
import { buildVm0007EvidenceMapDraft } from "../../src/lib/preverif/vm0007EvidenceMapDraft";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "../../src/lib/preverif/vm0007EvidenceContracts";
import { type Vm0007EvidenceBenchmarkMachineRow, type Vm0007EvidenceBenchmarkReviewedRow } from "../../src/lib/preverif/vm0007EvidenceBenchmark";
import { buildVm0007Rc3FalseSupportTaxonomy, serializeVm0007Rc3FalseSupportTaxonomy } from "../../src/lib/preverif/vm0007Rc3FalseSupportTaxonomy";

const root = process.cwd();
const artifactDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp");
const fixtureDir = path.join(root, "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
const richRulesPath = path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
const machinePath = path.join(fixtureDir, "machine-proposal.json");
const reviewedPath = path.join(fixtureDir, "gold.json");
const extractionPath = path.join(fixtureDir, "raw-document-extraction.json");
const outputPath = path.join(artifactDir, "RC3_FALSE_SUPPORT_TAXONOMY.json");
const read = (filePath: string) => JSON.parse(fs.readFileSync(filePath, "utf8")) as any;
const digest = (filePath: string) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const machine = read(machinePath);
const reviewed = read(reviewedPath);
const extraction = read(extractionPath);
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
  auditId: "rc3-current-same-run-comparison-vm0007-v18",
  generatedAt: "1970-01-01T00:00:00.000Z",
  rules: rules.map((rule: any) => ({ ...rule, snippet: rule.text, tags: [] })),
  audit,
  sourceDocument: { documentId: context.evidenceDocument.docId, documentName: "5953-Marcondes-Brazil-pdd.pdf", contentSha256: machine.sourceDocument.contentSha256 },
});
if (!draft.ok) throw new Error(`False-support taxonomy draft build blocked: ${draft.blockedBy.join(", ")}`);
const serializedProposal = JSON.stringify(draft.package);
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
const artifact = {
  ...taxonomy,
  source: {
    currentProposalKind: "same_run_serialized_reload",
    generatedProposalSha256: crypto.createHash("sha256").update(serializedProposal, "utf8").digest("hex"),
    auditExecutionSha256: crypto.createHash("sha256").update(JSON.stringify(audit), "utf8").digest("hex"),
    sourceExtractionSha256: digest(extractionPath),
    frozenRc2BaselineSha256: "15c0497eae4d128c3828fe951e204ff46db0aa282b711877b7556ecabe8787cf",
    reviewedTruthSha256: digest(reviewedPath),
    machineProposalFrozenSha256: digest(machinePath),
  },
  fixtureProtection: { reviewedTruthUnchanged: true, machineProposalUnchanged: true, rc2BaselineUnchanged: true },
};
fs.writeFileSync(outputPath, `${canonicalJsonStringify(artifact)}\n`, "utf8");
console.log(`Wrote false-support taxonomy: ${taxonomy.totalEvents} events; ${taxonomy.affectedRuleCount} rules.`);
