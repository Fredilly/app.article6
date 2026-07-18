import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-existing-packet-finalization-batch-1");
const scopePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const sourceDocument = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
const proposalRef = { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b", proposalState: "MACHINE_PROPOSED" as const };
const schemaVersion = "rc5-2-maya-existing-packet-finalization-batch-1-response-v1";
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-1-0014",
  "Verra.AFOLU.VM0007.v1-8.R-2-0009",
  "Verra.AFOLU.VM0007.v1-8.R-2-0010",
  "Verra.AFOLU.VM0007.v1-8.R-2-0011",
  "Verra.AFOLU.VM0007.v1-8.R-2-0012",
  "Verra.AFOLU.VM0007.v1-8.R-2-0015",
  "Verra.AFOLU.VM0007.v1-8.R-2-0016",
  "Verra.AFOLU.VM0007.v1-8.R-3-0002",
] as const;
const selectedRuleBatch: Record<string, number> = Object.fromEntries(selectedRuleIds.map((id) => [id, id.endsWith("R-1-0014") ? 3 : 4]));

const packetPaths: Record<string, string> = {
  "Verra.AFOLU.VM0007.v1-8.R-1-0014": "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/review-packet.json",
  ...Object.fromEntries(selectedRuleIds.slice(1).map((id) => [id, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/review-packet.json"])),
};
const reviewedTruthPaths: Record<number, string> = {
  3: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json",
  4: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json",
};
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const write = (filePath: string, value: unknown): void => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

type ScopeRule = { stableRuleId: string; batch: number; reviewStatus: string; existingFrozenPacketSufficientForIndependentReview: boolean; [key: string]: unknown };
type ProvisionalRow = Record<string, unknown> & { stableRuleId: string; reviewStatus: string };

export function buildArtifacts() {
  const scope = read<{ rules: ScopeRule[]; sourceCommitSha: string }>(scopePath);
  const scopeRules = new Map(scope.rules.map((rule) => [rule.stableRuleId, rule]));
  const proposal = read<{ rows: Array<Record<string, unknown> & { stableRuleId: string }> }>(proposalPath);
  if (sha256(fs.readFileSync(proposalPath)) !== proposalRef.sha256) throw new Error("Frozen machine proposal changed");
  const contexts: Record<string, unknown> = {};

  const rules = selectedRuleIds.map((stableRuleId) => {
    const scopeRule = scopeRules.get(stableRuleId);
    if (scopeRule && scopeRule.existingFrozenPacketSufficientForIndependentReview !== true) throw new Error(`Scope manifest does not authorize ${stableRuleId}`);
    const packetPath = packetPaths[stableRuleId];
    const packet = read<{ rules: Array<Record<string, unknown> & { stableRuleId: string }> }>(path.join(root, packetPath));
    const originalRule = packet.rules.find((rule) => rule.stableRuleId === stableRuleId);
    if (!originalRule) throw new Error(`Original frozen packet is missing ${stableRuleId}`);
    const truthPath = reviewedTruthPaths[scopeRule?.batch ?? selectedRuleBatch[stableRuleId]];
    const truth = read<{ decisions: ProvisionalRow[] }>(path.join(root, truthPath));
    const provisionalRow = truth.decisions.find((row) => row.stableRuleId === stableRuleId);
    if (!provisionalRow || !["PROVISIONAL", "REVIEWED"].includes(provisionalRow.reviewStatus)) throw new Error(`Current reviewed-truth row is missing for ${stableRuleId}`);
    const machineRow = proposal.rows.find((row) => row.stableRuleId === stableRuleId);
    if (!machineRow) throw new Error(`Frozen machine row is missing ${stableRuleId}`);
    const expectedHash = sha256(JSON.stringify(machineRow));
    if (originalRule.frozenMachineRowHash !== expectedHash) throw new Error(`Machine-row hash mismatch for ${stableRuleId}`);
    const candidates = [
      ...(originalRule.acceptedEvidence as any[] ?? []).map((evidence) => ({ evidence, sourcePath: packetPath, sourceType: "ORIGINAL_FROZEN_PACKET" })),
      ...(originalRule.rejectedEvidence as any[] ?? []).map((evidence) => ({ evidence, sourcePath: packetPath, sourceType: "ORIGINAL_FROZEN_PACKET" })),
      ...(provisionalRow.acceptedEvidence as any[] ?? []).map((evidence) => ({ evidence, sourcePath: truthPath, sourceType: "EXISTING_REVIEW_EVIDENCE" })),
      ...(provisionalRow.rejectedEvidence as any[] ?? []).map((evidence) => ({ evidence, sourcePath: truthPath, sourceType: "EXISTING_REVIEW_EVIDENCE" })),
    ];
    const deduped = new Map<string, any>();
    for (const { evidence, sourcePath, sourceType } of candidates) {
      const sectionHeading = evidence.sectionHeading ?? evidence.provenance?.sectionHeading ?? evidence.section ?? "";
      const identity = { quote: evidence.quote, page: evidence.page, sectionHeading, spanId: evidence.spanId, documentId: evidence.documentId ?? evidence.provenance?.docId ?? sourceDocument.documentId, documentSha256: evidence.documentSha256 ?? sourceDocument.contentSha256 };
      const key = JSON.stringify(identity);
      const existing = deduped.get(key);
      const sourceReference = { path: sourcePath, sourceType };
      if (existing) {
        existing.sourceAudit.references.push(sourceReference);
        if (!existing.provenance && evidence.provenance) existing.provenance = evidence.provenance;
      }
      else deduped.set(key, { ...identity, provenance: evidence.provenance ?? null, sourceAudit: { references: [sourceReference] } });
    }
    const candidateEvidence = [...deduped.values()].map((candidate, index) => {
      const contextId = `candidate-${stableRuleId.split(".").at(-1)}-${index + 1}`;
      contexts[contextId] = { contextId, documentIdentity: sourceDocument, pageNumber: candidate.page, sectionHeading: candidate.sectionHeading, sourceSpanId: candidate.spanId, exactQuote: candidate.quote, provenance: candidate.provenance };
      return { ...candidate, contextId };
    });
    return {
      stableRuleId,
      shortRuleId: originalRule.shortRuleId,
      requirementText: originalRule.requirementText,
      frozenMachineRowHash: originalRule.frozenMachineRowHash,
      candidateEvidence,
      sourcePacket: { path: packetPath, label: "ORIGINAL_FROZEN_PACKET", evidenceIsUnchanged: true },
      sourceAudit: { reviewEvidenceSourcePath: truthPath, label: "EVIDENCE_ORIGIN_ONLY_NO_PRIOR_CLASSIFICATION" },
    };
  });
  const template = {
    schemaVersion,
    sourceDocument,
    machineProposalRef: proposalRef,
    decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowHash, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, provisionalReason: null, genericFailureCategory: null, reviewerConfidence: null })),
  };
  const packet = {
    schemaVersion: "rc5-2-maya-existing-packet-finalization-batch-1-review-packet-v1",
    reviewPurpose: "Independent review of eight Maya rules selected by the merged provisional-scope manifest as reviewable from existing evidence. No new full-PDD retrieval was performed; this packet does not establish evidence sufficiency or disclose prior judgments.",
    sourceDocument,
    frozenMachineProposal: proposalRef,
    provisionalScopeManifest: { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json", sourceCommitSha: scope.sourceCommitSha, sha256: sha256(fs.readFileSync(scopePath)), label: "NON_FINAL_SCOPE_CONTEXT" },
    selectedRuleIds: [...selectedRuleIds],
    contexts,
    rules,
    evidencePolicy: { label: "NEUTRAL_EXISTING_EVIDENCE_CANDIDATES", newFullPddRetrieval: false, evidenceIsUnchanged: true, candidatesAreProvenanceDeduplicated: true, selectionSource: "MERGED_PROVISIONAL_SCOPE_MANIFEST" },
  };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document: sourceDocument, machineProposalRef: proposalRef, ruleIds: [...selectedRuleIds], decisionCount: selectedRuleIds.length });
  return { packet, schema, template };
}

export function writeArtifacts(outputDir = packetDir) {
  const artifacts = buildArtifacts();
  fs.mkdirSync(outputDir, { recursive: true });
  write(path.join(outputDir, "review-packet.json"), artifacts.packet);
  write(path.join(outputDir, "review-template.json"), artifacts.template);
  write(path.join(outputDir, "review-response-schema.json"), artifacts.schema);
  write(path.join(outputDir, "manifest.json"), {
    schemaVersion: "rc5-2-maya-existing-packet-finalization-batch-1-manifest-v1",
    generatedAt: "2026-07-19T00:00:00.000Z",
    sourceCommitSha: "2c201ab7ce9a83b28ffa751a8a481dccab4f3096",
    sourceDocumentSha256: sourceDocument.contentSha256,
    frozenProposalSha256: proposalRef.sha256,
    selectedRuleIds: [...selectedRuleIds],
    machineRowSha256: Object.fromEntries(artifacts.packet.rules.map((rule: any) => [rule.stableRuleId, rule.frozenMachineRowHash])),
    evidenceCounts: Object.fromEntries(artifacts.packet.rules.map((rule: any) => [rule.stableRuleId, { uniqueCandidateEvidence: rule.candidateEvidence.length, contexts: rule.candidateEvidence.length }])),
    generatedPacketSha256: sha256(fs.readFileSync(path.join(outputDir, "review-packet.json"))),
    packetFiles: ["review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json"],
  });
  return artifacts;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
