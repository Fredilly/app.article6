import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-existing-packet-finalization-batch-1");
const selectionPath = path.join(packetDir, "pre-review-selection.json");
const historicalCommit = "83be72a44b1beb7e4d14ab5272f2d1ea3eeb208f";
const evidenceSnapshotPath = path.join(packetDir, "pre-review-evidence-snapshot.json");
const blindPacketPath = path.join(packetDir, "pre-review-blind-packet.json");
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

const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const write = (filePath: string, value: unknown): void => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

type HistoricalInput = { commitSha: string; path: string; sha256: string };
type Selection = { sourceCommitSha: string; selectedRuleIds: string[]; originalScopeArtifact: HistoricalInput & { provisionalRuleCount: number }; authorization: Array<{ stableRuleId: string; sourceBatch: number; authorized: boolean; existingFrozenPacketSufficientForIndependentReview: boolean }>; sourcePackets: Record<string, HistoricalInput>; reviewedTruth: Record<string, HistoricalInput>; blindPacket: { path: string; sha256: string }; deepSeekReviewedPacket: HistoricalInput; machineProposal: HistoricalInput };

const historicalBytes = (input: HistoricalInput): Buffer => {
  if (input.commitSha !== historicalCommit) throw new Error(`Unexpected historical commit for ${input.path}`);
  try {
    const bytes = execFileSync("git", ["show", `${input.commitSha}:${input.path}`]);
    if (sha256(bytes) !== input.sha256) throw new Error(`Historical SHA mismatch: ${input.path}`);
    return bytes;
  } catch (error) {
    throw new Error(`Unable to load historical Git input ${input.commitSha}:${input.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const historicalJson = <T>(input: HistoricalInput): T => JSON.parse(historicalBytes(input).toString("utf8")) as T;

export function buildArtifacts(selectionOverride?: Selection) {
  const selection = selectionOverride ?? read<Selection>(selectionPath);
  if (!selectionOverride && sha256(fs.readFileSync(selectionPath)) !== "1ffdf2ef2116b8962793a92052387fcd0d52815b708cd0810ebc10089c2614d0") throw new Error("Immutable pre-review selection artifact changed");
  if (selection.originalScopeArtifact.sha256 !== "48780a5fa81d16df09d6b98e53af1be49b78a7935ed8f5e93e88712588b23c17" || selection.originalScopeArtifact.provisionalRuleCount !== 27) throw new Error("Original pre-review scope authorization changed");
  historicalBytes(selection.originalScopeArtifact);
  historicalBytes(selection.deepSeekReviewedPacket);
  historicalBytes(selection.machineProposal);
  for (const source of Object.values(selection.sourcePackets)) historicalBytes(source);
  for (const truth of Object.values(selection.reviewedTruth)) historicalBytes(truth);
  for (const selectedRuleId of selectedRuleIds) if (!selection.selectedRuleIds.includes(selectedRuleId)) throw new Error(`Immutable pre-review selection is missing selected rule ${selectedRuleId}`);
  if (selection.selectedRuleIds.length !== selectedRuleIds.length) throw new Error("Immutable selected rule IDs changed");
  if (selection.authorization.length !== selectedRuleIds.length || selection.authorization.some((entry, index) => entry.stableRuleId !== selectedRuleIds[index] || !entry.authorized || entry.existingFrozenPacketSufficientForIndependentReview !== true)) throw new Error("Immutable pre-review authorization changed");
  const sourceSnapshot = historicalJson<Record<string, any>>(selection.deepSeekReviewedPacket);
  const proposal = historicalJson<{ rows: Array<Record<string, any> & { stableRuleId: string }> }>(selection.machineProposal);
  const scope = historicalJson<{ rules: Array<Record<string, any>> }>(selection.originalScopeArtifact);
  if (scope.rules.filter((rule) => rule.reviewStatus === "PROVISIONAL").length !== 27) throw new Error("Historical scope inventory changed");
  if (JSON.stringify(sourceSnapshot.selectedRuleIds) !== JSON.stringify(selectedRuleIds) || sourceSnapshot.rules.length !== selectedRuleIds.length) throw new Error("Historical pre-review packet selection changed");
  const contexts: Record<string, any> = {};
  const packet = {
    schemaVersion: "rc5-2-maya-existing-packet-finalization-batch-1-review-v2",
    reviewPurpose: "Independent review of eight rules selected by the merged provisional-scope manifest as reviewable from existing evidence. No new full-PDD retrieval was performed; prior machine judgments are non-final context.",
    sourceDocument: sourceSnapshot.sourceDocument,
    frozenMachineProposal: { path: selection.machineProposal.path, sha256: selection.machineProposal.sha256, proposalState: "MACHINE_PROPOSED" },
    provisionalScopeManifest: { path: selection.originalScopeArtifact.path, sourceCommitSha: selection.originalScopeArtifact.commitSha, sha256: selection.originalScopeArtifact.sha256, label: "HISTORICAL_SELECTION_CONTEXT" },
    selectedRuleIds: [...selectedRuleIds],
    contexts,
    rules: [] as any[],
    evidencePolicy: { label: "NEUTRAL_CANDIDATE_EVIDENCE", newFullPddRetrieval: false, evidenceIsUnchanged: true, priorMachineJudgmentsAreNonFinal: true },
  };
  for (const entry of selection.authorization) {
    const source = selection.sourcePackets[String(entry.sourceBatch)];
    if (!source) throw new Error(`Missing immutable source batch ${entry.sourceBatch}`);
    const sourcePacket = historicalJson<{ rules: Array<Record<string, any> & { stableRuleId: string }> }>(source);
    if (!sourcePacket.rules.some((rule) => rule.stableRuleId === entry.stableRuleId)) throw new Error(`Source batch ${entry.sourceBatch} is missing ${entry.stableRuleId}`);
    const truthInput = selection.reviewedTruth[String(entry.sourceBatch)];
    if (!truthInput) throw new Error(`Missing historical reviewed-truth input for batch ${entry.sourceBatch}`);
    const truth = historicalJson<{ decisions: Array<Record<string, any> & { stableRuleId: string }> }>(truthInput);
    if (!truth.decisions.some((row) => row.stableRuleId === entry.stableRuleId && row.reviewStatus === "PROVISIONAL")) throw new Error(`Historical reviewed truth is missing provisional ${entry.stableRuleId}`);
    const sourceRule = sourcePacket.rules.find((rule: any) => rule.stableRuleId === entry.stableRuleId);
    const snapshotRule = sourceSnapshot.rules.find((rule: any) => rule.stableRuleId === entry.stableRuleId);
    const truthRow = truth.decisions.find((row) => row.stableRuleId === entry.stableRuleId)!;
    const machineRow = proposal.rows.find((row) => row.stableRuleId === entry.stableRuleId);
    if (!machineRow || sha256(JSON.stringify(machineRow)) !== sourceRule.frozenMachineRowHash || sourceRule.frozenMachineRowHash !== snapshotRule.frozenMachineRowHash) throw new Error(`Machine-row hash mismatch for ${entry.stableRuleId}`);
    const candidates = [...(sourceRule.acceptedEvidence ?? []), ...(sourceRule.rejectedEvidence ?? []), ...(truthRow.acceptedEvidence ?? []), ...(truthRow.rejectedEvidence ?? [])];
    const seen = new Set<string>();
    const candidateEvidence = candidates.filter((candidate: any) => {
      const provenance = candidate.provenance ?? {};
      const candidateDocumentId = candidate.documentId ?? provenance.docId ?? sourceSnapshot.sourceDocument.documentId;
      const candidateDocumentSha256 = candidate.documentSha256 ?? provenance.documentSha256 ?? sourceSnapshot.sourceDocument.contentSha256;
      if (candidateDocumentId !== sourceSnapshot.sourceDocument.documentId || candidateDocumentSha256 !== sourceSnapshot.sourceDocument.contentSha256) throw new Error(`Evidence identity mismatch for ${entry.stableRuleId}`);
      const key = JSON.stringify({ quote: candidate.quote, page: candidate.page, sectionHeading: provenance.sectionHeading ?? candidate.section, spanId: candidate.spanId ?? provenance.spanId, documentId: sourceSnapshot.sourceDocument.documentId, documentSha256: sourceSnapshot.sourceDocument.contentSha256 });
      if (seen.has(key)) return false;
      seen.add(key);
      const contextId = `candidate-${entry.stableRuleId}-${seen.size}`;
      contexts[contextId] = { contextId, exactQuote: candidate.quote, sourceSpanId: candidate.spanId ?? provenance.spanId, page: candidate.page, sectionHeading: provenance.sectionHeading ?? candidate.section, documentId: sourceSnapshot.sourceDocument.documentId, documentSha256: sourceSnapshot.sourceDocument.contentSha256 };
      return true;
    }).map((candidate: any, index: number) => {
      const provenance = candidate.provenance ?? {};
      const contextId = `candidate-${entry.stableRuleId}-${index + 1}`;
      return { quote: candidate.quote, page: candidate.page, sectionHeading: provenance.sectionHeading ?? candidate.section, spanId: candidate.spanId ?? provenance.spanId, documentId: sourceSnapshot.sourceDocument.documentId, documentSha256: sourceSnapshot.sourceDocument.contentSha256, evidenceType: candidate.evidenceType, provenance: { documentId: sourceSnapshot.sourceDocument.documentId, documentSha256: sourceSnapshot.sourceDocument.contentSha256, page: candidate.page, sectionHeading: provenance.sectionHeading ?? candidate.section, spanId: candidate.spanId ?? provenance.spanId, sourceType: provenance.sourceType }, contextId, sourceAudit: { sourceType: "FROZEN_CANDIDATE_EVIDENCE", references: [{ sourceType: "FROZEN_CANDIDATE_EVIDENCE", sourceBatch: entry.sourceBatch, sourcePacketPath: source.path, sourceEvidenceSnapshotPath: evidenceSnapshotPath.replace(`${root}/`, ""), sourceRuleId: entry.stableRuleId, sourceRole: "candidate-evidence" }] } };
    });
    packet.rules.push({ stableRuleId: entry.stableRuleId, shortRuleId: snapshotRule.shortRuleId, canonicalPosition: snapshotRule.canonicalPosition, requirementText: snapshotRule.requirementText, frozenMachineRowHash: snapshotRule.frozenMachineRowHash, sourcePacket: { path: source.path, label: "ORIGINAL_FROZEN_PACKET", evidenceIsUnchanged: true }, historicalMachineContext: { label: "NON_FINAL_MACHINE_CONTEXT", machineRowHash: snapshotRule.frozenMachineRowHash }, candidateEvidence });
  }
  const template = read<Record<string, any>>(path.join(packetDir, "review-template.json"));
  const schema = read<Record<string, any>>(path.join(packetDir, "review-response-schema.json"));
  return { packet: JSON.parse(JSON.stringify(packet)) as Record<string, any>, schema, template, selection, historicalEvidenceSnapshot: historicalBytes(selection.deepSeekReviewedPacket) };
}

export function writeArtifacts(outputDir = packetDir) {
  const artifacts = buildArtifacts();
  fs.mkdirSync(outputDir, { recursive: true });
  const snapshotOutputPath = path.join(outputDir, "pre-review-evidence-snapshot.json");
  if (outputDir === packetDir && fs.existsSync(snapshotOutputPath) && !fs.readFileSync(snapshotOutputPath).equals(artifacts.historicalEvidenceSnapshot)) throw new Error("Generated historical evidence snapshot differs from the committed convenience snapshot");
  fs.writeFileSync(snapshotOutputPath, artifacts.historicalEvidenceSnapshot);
  write(path.join(outputDir, "pre-review-blind-packet.json"), artifacts.packet);
  write(path.join(outputDir, "review-packet.json"), artifacts.packet);
  const generatedPacketSha256 = sha256(fs.readFileSync(path.join(outputDir, "review-packet.json")));
  if (generatedPacketSha256 !== artifacts.selection.blindPacket.sha256) throw new Error("Generated blind packet differs from the frozen pre-review packet");
  write(path.join(outputDir, "review-template.json"), artifacts.template);
  write(path.join(outputDir, "review-response-schema.json"), artifacts.schema);
  write(path.join(outputDir, "manifest.json"), {
    schemaVersion: "rc5-2-maya-existing-packet-finalization-batch-1-manifest-v1",
    purpose: "Neutral blind packet generated exclusively from pinned historical Git inputs; convenience snapshots are regenerated outputs and are not historical authority.",
    currentTruthIsNotAnInput: true,
    generatedAt: "2026-07-19T00:00:00.000Z",
    sourceCommitSha: "83be72a44b1beb7e4d14ab5272f2d1ea3eeb208f",
    sourceDocumentSha256: artifacts.packet.sourceDocument.contentSha256,
    preReviewSelectionSha256: sha256(fs.readFileSync(selectionPath)),
    originalScopeArtifactSha256: artifacts.selection.originalScopeArtifact.sha256,
    originalSourcePacketSha256: Object.fromEntries(Object.entries(artifacts.selection.sourcePackets).map(([batch, source]) => [batch, source.sha256])),
    historicalReviewedTruthSha256: Object.fromEntries(Object.entries(artifacts.selection.reviewedTruth).map(([batch, truth]) => [batch, { commitSha: truth.commitSha, path: truth.path, sha256: truth.sha256 }])),
    historicalInputs: {
      scope: artifacts.selection.originalScopeArtifact,
      sourcePackets: artifacts.selection.sourcePackets,
      reviewedTruth: artifacts.selection.reviewedTruth,
      machineProposal: artifacts.selection.machineProposal,
      deepSeekReviewedPacket: artifacts.selection.deepSeekReviewedPacket,
    },
    deepSeekReviewedPacketSha256: artifacts.selection.deepSeekReviewedPacket.sha256,
    frozenBlindPacketSha256: artifacts.selection.blindPacket.sha256,
    frozenProposalSha256: artifacts.selection.machineProposal.sha256,
    selectedRuleIds: [...selectedRuleIds],
    machineRowSha256: Object.fromEntries(artifacts.packet.rules.map((rule: any) => [rule.stableRuleId, rule.frozenMachineRowHash])),
    evidenceCounts: Object.fromEntries(artifacts.packet.rules.map((rule: any) => [rule.stableRuleId, { uniqueCandidateEvidence: rule.candidateEvidence.length, contexts: rule.candidateEvidence.length }])),
    generatedPacketSha256,
    packetFiles: ["pre-review-selection.json", "pre-review-evidence-snapshot.json", "pre-review-blind-packet.json", "review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json"],
    generatedConvenienceArtifacts: ["pre-review-evidence-snapshot.json", "pre-review-blind-packet.json"],
  });
  return artifacts;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
