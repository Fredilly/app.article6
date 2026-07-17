import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";
import { readRc5BatchSelectionEntry, type Rc5BatchSelectionManifest } from "./rc5-batch-selection-manifest";

export type Rc5BatchGeneratorConfig = {
  batchNumber: number;
  batchManifestPath: string;
  expectedBatchSelectionSha256: string;
  frozenProposalPath: string;
  machineProposalRefPath: string;
  auditPath: string;
  extractionPath: string;
  canonicalRawExtractionRefPath: string;
  expectedMachineProposalSha256: string;
  expectedDocumentSha256: string;
  expectedExtractionSha256: string;
  expectedAuditSha256: string;
  outputDir: string;
  sourceCommitSha: string;
  packetSchemaVersion: string;
  responseSchemaVersion: string;
  manifestSchemaVersion: string;
  reviewPurpose: string;
  priorArtifactPaths: string[];
  decisionCount: number;
};

type Evidence = { quote: string; page: number; section: string; spanId: string; provenance: Record<string, unknown>; evidenceType?: string; rejectionReason?: string };
type FrozenRow = Record<string, any> & { stableRuleId: string };
type Proposal = { rows: FrozenRow[]; sourceDocument: { documentId: string; documentName: string; contentSha256: string }; proposalState: string; auditId: string };
export type Rc5BatchArtifacts = {
  packet: Record<string, any>;
  schema: Record<string, any>;
  template: Record<string, any>;
  selectedRuleIds: string[];
  priorIds: string[];
  frozen: Proposal;
  raw: { pages: Array<{ pageNumber: number; text: string }> };
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
export const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const writeJson = (filePath: string, value: unknown): void => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalSerialize(item)).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error(`Cannot canonically serialize ${typeof value}`);
}

function assertSha(actual: string, expected: string, label: string): void {
  if (actual !== expected) throw new Error(`${label} SHA mismatch: expected ${expected}, got ${actual}`);
}

function assertExactKeys(actual: string[], expected: string[], label: string): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  if (actualSet.size !== actual.length || expectedSet.size !== expected.length || actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} keys do not exactly match expected rule IDs`);
  }
}

function readPriorRuleIds(priorArtifactPaths: string[]): string[] {
  const ids = priorArtifactPaths.flatMap((artifactPath) => {
    const artifact = readJson<Record<string, unknown>>(path.resolve(artifactPath));
    return ["rules", "decisions", "rows"].flatMap((key) => Array.isArray(artifact[key]) ? (artifact[key] as Array<{ stableRuleId?: string }>).flatMap((row) => row.stableRuleId ? [row.stableRuleId] : []) : []);
  });
  return [...new Set(ids)];
}

function assertFrozenInputs(config: Rc5BatchGeneratorConfig): { selection: Rc5BatchSelectionManifest["batches"][string]; frozen: Proposal; raw: { pages: Array<{ pageNumber: number; text: string }> } } {
  const selection = readRc5BatchSelectionEntry(config.batchNumber, config.batchManifestPath);
  assertSha(sha256(canonicalSerialize(selection)), config.expectedBatchSelectionSha256, `RC5 Batch ${config.batchNumber} selection`);
  const proposalBytes = fs.readFileSync(config.frozenProposalPath);
  assertSha(sha256(proposalBytes), config.expectedMachineProposalSha256, "Machine proposal");
  const rawBytes = fs.readFileSync(config.extractionPath);
  assertSha(sha256(rawBytes), config.expectedExtractionSha256, "Canonical extraction");
  assertSha(sha256(fs.readFileSync(config.auditPath)), config.expectedAuditSha256, "Audit record");
  const frozen = JSON.parse(proposalBytes.toString("utf8")) as Proposal;
  assertSha(frozen.sourceDocument.contentSha256, config.expectedDocumentSha256, "Source document");
  if (frozen.proposalState !== "MACHINE_PROPOSED") throw new Error(`Expected MACHINE_PROPOSED input, got ${frozen.proposalState}`);
  const expectedRowHashes = selection.expectedMachineRowSha256;
  if (!expectedRowHashes) throw new Error(`RC5 Batch ${config.batchNumber} is missing frozen machine row hashes`);
  assertExactKeys(Object.keys(expectedRowHashes), selection.expectedRuleIds, "Frozen machine row hash manifest");
  return { selection, frozen, raw: JSON.parse(rawBytes.toString("utf8")) as { pages: Array<{ pageNumber: number; text: string }> } };
}

function buildContext(evidence: Evidence, pages: Array<{ pageNumber: number; text: string }>, contextId: string, document: Proposal["sourceDocument"]) {
  const heading = String(evidence.provenance.sectionHeading ?? evidence.section ?? "");
  const normalizedHeading = heading.toLowerCase().replace(/\s+/g, " ").trim();
  const located = pages.find((page) => page.text.toLowerCase().replace(/\s+/g, " ").includes(normalizedHeading));
  const text = located?.text ?? pages[0]?.text ?? "";
  const index = normalizedHeading ? text.toLowerCase().replace(/\s+/g, " ").indexOf(normalizedHeading) : 0;
  const start = Math.max(0, index < 0 ? 0 : index);
  return { contextId, documentIdentity: document, pageNumber: located?.pageNumber ?? evidence.page, sectionHeading: heading, sourceSpanId: evidence.spanId, exactQuote: evidence.quote, matchFoundInCanonicalExtraction: text.includes(evidence.quote), surroundingText: { before: text.slice(Math.max(0, start - 1800), start), matched: evidence.quote, after: text.slice(start + Math.min(heading.length, text.length), start + Math.min(heading.length, text.length) + 1800) } };
}

function evidenceReference(evidence: Evidence, document: Proposal["sourceDocument"], index: number) {
  return { index, quote: evidence.quote, page: evidence.page, sectionHeading: evidence.provenance.sectionHeading ?? evidence.section, spanId: evidence.spanId, documentId: document.documentId, documentSha256: document.contentSha256, provenance: evidence.provenance };
}

export function buildRc5BatchArtifacts(config: Rc5BatchGeneratorConfig): Rc5BatchArtifacts {
  const { selection, frozen, raw } = assertFrozenInputs(config);
  const expectedRuleIds = selection.expectedRuleIds;
  const priorIds = readPriorRuleIds(config.priorArtifactPaths);
  const priorSet = new Set(priorIds);
  const selected = expectedRuleIds.map((stableRuleId) => {
    const row = frozen.rows.find((candidate) => candidate.stableRuleId === stableRuleId);
    if (!row) throw new Error(`RC5 Batch ${config.batchNumber} frozen proposal is missing manifest rule ${stableRuleId}`);
    if (priorSet.has(stableRuleId)) throw new Error(`RC5 Batch ${config.batchNumber} rule overlaps prior review: ${stableRuleId}`);
    const generatedRowSha256 = sha256(JSON.stringify(row));
    assertSha(generatedRowSha256, selection.expectedMachineRowSha256![stableRuleId], `Machine row ${stableRuleId}`);
    return { row, canonicalPosition: frozen.rows.indexOf(row) + 1 };
  });
  if (selected.length !== config.decisionCount) throw new Error(`Expected ${config.decisionCount} selected rows, got ${selected.length}`);
  assertRc5RuleCoverage(selected.map(({ row }) => row.stableRuleId), expectedRuleIds, `RC5 Batch ${config.batchNumber} selection`);
  const document = frozen.sourceDocument;
  const contexts: Record<string, unknown> = {};
  const rules = selected.map(({ row, canonicalPosition }) => {
    const accepted = row.acceptedEvidence as Evidence[];
    const rejected = row.rejectedEvidence as Evidence[];
    const refs = { accepted: [] as unknown[], rejected: [] as unknown[] };
    const addEvidence = (items: Evidence[], kind: "accepted" | "rejected") => items.map((evidence, index) => {
      const contextId = `batch${config.batchNumber}-${row.stableRuleId.split(".").at(-1)}-${kind}-${index + 1}`;
      contexts[contextId] = buildContext(evidence, raw.pages, contextId, document);
      refs[kind].push(evidenceReference(evidence, document, index));
      return contextId;
    });
    const acceptedContextIds = addEvidence(accepted, "accepted");
    const rejectedContextIds = addEvidence(rejected, "rejected");
    return { stableRuleId: row.stableRuleId, shortRuleId: row.stableRuleId.split(".").at(-1), canonicalPosition, requirementText: row.requirementText, proposedEvidenceState: row.proposedEvidenceStatus, proposedApplicability: row.proposedApplicability, acceptedEvidence: accepted, rejectedEvidence: rejected, exactQuoteText: row.quote, provenance: row.provenance, machineAssessment: { assessmentReason: row.assessmentReason, gap: row.gap, clientAction: row.clientAction, componentCoverage: row.componentCoverage, contradictions: row.contradictions, confidence: row.confidence }, exactFrozenMachineRow: row, frozenMachineRowHash: sha256(JSON.stringify(row)), sourceContext: { primaryContextId: acceptedContextIds[0] ?? rejectedContextIds[0] ?? null, evidenceContextRefs: refs } };
  });
  const selectedRuleIds = selected.map(({ row }) => row.stableRuleId);
  const proposalRef = { path: config.machineProposalRefPath, sha256: sha256(fs.readFileSync(config.frozenProposalPath)), proposalState: "MACHINE_PROPOSED" as const };
  const packet = { schemaVersion: config.packetSchemaVersion, reviewPurpose: config.reviewPurpose, sourceDocument: document, frozenMachineProposal: { ...proposalRef, auditId: frozen.auditId }, canonicalRawExtraction: { path: config.canonicalRawExtractionRefPath, sha256: sha256(fs.readFileSync(config.extractionPath)), pageCount: raw.pages.length, extractionEngine: "pdf-parse" }, reviewedRuleExclusion: { derivation: "Union of stableRuleId values from prior packet selections and reviewed-comparison rows; used only to prevent overlap and contains no prior human decisions.", artifacts: config.priorArtifactPaths, reviewedRuleIds: priorIds }, selectedRuleIds, contexts, rules, counts: { rules: rules.length, proposedEvidenceStates: Object.fromEntries(["FOUND", "UNCLEAR", "MISSING"].map((state) => [state, rules.filter((rule) => rule.proposedEvidenceState === state).length])) } };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion: config.responseSchemaVersion, document, machineProposalRef: proposalRef, ruleIds: selectedRuleIds, decisionCount: config.decisionCount });
  const template = { schemaVersion: config.responseSchemaVersion, sourceDocument: document, machineProposalRef: proposalRef, decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowHash, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  assertRc5RuleCoverage(template.decisions.map((decision) => decision.stableRuleId), expectedRuleIds, `RC5 Batch ${config.batchNumber} template`);
  return { packet, schema, template, selectedRuleIds, priorIds, frozen, raw };
}

export function writeRc5BatchArtifacts(config: Rc5BatchGeneratorConfig): Rc5BatchArtifacts {
  const artifacts = buildRc5BatchArtifacts(config);
  fs.mkdirSync(config.outputDir, { recursive: true });
  writeJson(path.join(config.outputDir, "review-packet.json"), artifacts.packet);
  writeJson(path.join(config.outputDir, "review-response-schema.json"), artifacts.schema);
  writeJson(path.join(config.outputDir, "review-template.json"), artifacts.template);
  const manifest = { schemaVersion: config.manifestSchemaVersion, generatedAt: "2026-07-17T00:00:00.000Z", sourceCommitSha: config.sourceCommitSha, sourceDocumentSha256: artifacts.packet.sourceDocument.contentSha256, frozenProposalSha256: artifacts.packet.frozenMachineProposal.sha256, canonicalRawExtractionSha256: artifacts.packet.canonicalRawExtraction.sha256, auditRecordSha256: sha256(fs.readFileSync(config.auditPath)), selectedRuleIds: artifacts.selectedRuleIds, reviewedRuleIds: artifacts.priorIds, machineRowSha256: Object.fromEntries(artifacts.packet.rules.map((rule: { stableRuleId: string; frozenMachineRowHash: string }) => [rule.stableRuleId, rule.frozenMachineRowHash])), generatedPacketSha256: sha256(fs.readFileSync(path.join(config.outputDir, "review-packet.json"))), packetFiles: ["review-packet.json", "review-response-schema.json", "review-template.json", "review-instructions.md", "agent-prompt.md"] };
  writeJson(path.join(config.outputDir, "manifest.json"), manifest);
  return artifacts;
}
