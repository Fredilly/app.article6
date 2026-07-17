import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";
import { readRc5BatchSelection } from "./rc5-batch-selection-manifest";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-3-adjudication");
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const auditPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json");
const rawPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const batch1PacketPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication/review-packet.json");
const batch2PacketPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication/review-packet.json");
const comparisonPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json");
const sourceCommitSha = "4cd00443271226063ef53960dcf195add1c94c38";

type Evidence = { quote: string; page: number; section: string; spanId: string; provenance: Record<string, unknown>; evidenceType?: string; rejectionReason?: string };
type FrozenRow = Record<string, any> & { stableRuleId: string };
type Proposal = { rows: FrozenRow[]; sourceDocument: { documentId: string; documentName: string; contentSha256: string }; proposalState: string; auditId: string };
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const writeJson = (filePath: string, value: unknown): void => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

function buildContext(evidence: Evidence, pages: Array<{ pageNumber: number; text: string }>, contextId: string, document: Proposal["sourceDocument"]) {
  const heading = String(evidence.provenance.sectionHeading ?? evidence.section ?? "");
  const normalizedHeading = heading.toLowerCase().replace(/\s+/g, " ").trim();
  const located = pages.find((page) => page.text.toLowerCase().replace(/\s+/g, " ").includes(normalizedHeading));
  const text = located?.text ?? pages[0]?.text ?? "";
  const index = normalizedHeading ? text.toLowerCase().replace(/\s+/g, " ").indexOf(normalizedHeading) : 0;
  const start = Math.max(0, index < 0 ? 0 : index);
  return {
    contextId,
    documentIdentity: document,
    pageNumber: located?.pageNumber ?? evidence.page,
    sectionHeading: heading,
    sourceSpanId: evidence.spanId,
    exactQuote: evidence.quote,
    matchFoundInCanonicalExtraction: text.includes(evidence.quote),
    surroundingText: { before: text.slice(Math.max(0, start - 1800), start), matched: evidence.quote, after: text.slice(start + Math.min(heading.length, text.length), start + Math.min(heading.length, text.length) + 1800) },
  };
}

function evidenceReference(evidence: Evidence, document: Proposal["sourceDocument"], index: number) {
  return { index, quote: evidence.quote, page: evidence.page, sectionHeading: evidence.provenance.sectionHeading ?? evidence.section, spanId: evidence.spanId, documentId: document.documentId, documentSha256: document.contentSha256, provenance: evidence.provenance };
}

export function assertBatch3GeneratedRuleCoverage(generatedRuleIds: string[], label = "RC5 Batch 3"): string[] {
  const expected = readRc5BatchSelection(3);
  assertRc5RuleCoverage(generatedRuleIds, expected, label);
  return expected;
}

export function buildArtifacts() {
  const frozen = readJson<Proposal>(frozenPath);
  const raw = readJson<{ pages: Array<{ pageNumber: number; text: string }> }>(rawPath);
  const batch1Packet = readJson<{ rules: Array<{ stableRuleId: string }> }>(batch1PacketPath);
  const batch2Packet = readJson<{ rules: Array<{ stableRuleId: string }> }>(batch2PacketPath);
  const comparison = readJson<{ rows: Array<{ stableRuleId: string }> }>(comparisonPath);
  const priorIds = [...new Set([...batch1Packet.rules, ...batch2Packet.rules, ...comparison.rows].map((row) => row.stableRuleId))];
  const priorSet = new Set(priorIds);
  const expected = readRc5BatchSelection(3);
  const selected = expected.map((stableRuleId) => {
    const row = frozen.rows.find((candidate) => candidate.stableRuleId === stableRuleId);
    if (!row) throw new Error(`RC5 Batch 3 frozen proposal is missing manifest rule ${stableRuleId}`);
    if (priorSet.has(stableRuleId)) throw new Error(`RC5 Batch 3 rule overlaps prior review: ${stableRuleId}`);
    return { row, canonicalPosition: frozen.rows.indexOf(row) + 1 };
  });
  if (selected.length !== 10 || new Set(selected.map(({ row }) => row.stableRuleId)).size !== 10) throw new Error("RC5 Batch 3 must contain exactly 10 unique rules");
  assertBatch3GeneratedRuleCoverage(selected.map(({ row }) => row.stableRuleId), "RC5 Batch 3 selection");
  const document = frozen.sourceDocument;
  const contexts: Record<string, unknown> = {};
  const rules = selected.map(({ row, canonicalPosition }) => {
    const accepted = row.acceptedEvidence as Evidence[];
    const rejected = row.rejectedEvidence as Evidence[];
    const refs = { accepted: [] as unknown[], rejected: [] as unknown[] };
    const addEvidence = (items: Evidence[], kind: "accepted" | "rejected") => items.map((evidence, index) => {
      const contextId = `batch3-${row.stableRuleId.split(".").at(-1)}-${kind}-${index + 1}`;
      contexts[contextId] = buildContext(evidence, raw.pages, contextId, document);
      refs[kind].push(evidenceReference(evidence, document, index));
      return contextId;
    });
    const acceptedContextIds = addEvidence(accepted, "accepted");
    const rejectedContextIds = addEvidence(rejected, "rejected");
    return {
      stableRuleId: row.stableRuleId,
      shortRuleId: row.stableRuleId.split(".").at(-1),
      canonicalPosition,
      requirementText: row.requirementText,
      proposedEvidenceState: row.proposedEvidenceStatus,
      proposedApplicability: row.proposedApplicability,
      acceptedEvidence: accepted,
      rejectedEvidence: rejected,
      exactQuoteText: row.quote,
      provenance: row.provenance,
      machineAssessment: { assessmentReason: row.assessmentReason, gap: row.gap, clientAction: row.clientAction, componentCoverage: row.componentCoverage, contradictions: row.contradictions, confidence: row.confidence },
      exactFrozenMachineRow: row,
      frozenMachineRowHash: sha256(JSON.stringify(row)),
      sourceContext: { primaryContextId: acceptedContextIds[0] ?? rejectedContextIds[0] ?? null, evidenceContextRefs: refs },
    };
  });
  const selectedRuleIds = selected.map(({ row }) => row.stableRuleId);
  const proposalRef = { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: sha256(fs.readFileSync(frozenPath)), proposalState: "MACHINE_PROPOSED" as const };
  const packet = {
    schemaVersion: "rc5-2-maya-batch-3-adjudication-review-packet-v1",
    reviewPurpose: "Independent adjudication of the next ten unreviewed frozen Maya machine-proposed rules.",
    sourceDocument: document,
    frozenMachineProposal: { ...proposalRef, auditId: frozen.auditId },
    canonicalRawExtraction: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: sha256(fs.readFileSync(rawPath)), pageCount: raw.pages.length, extractionEngine: "pdf-parse" },
    reviewedRuleExclusion: { derivation: "Union of stableRuleId values from prior packet selections and reviewed-comparison rows; used only to prevent overlap and contains no prior human decisions.", artifacts: ["docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication/review-packet.json", "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication/review-packet.json", "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json"], reviewedRuleIds: priorIds },
    selectedRuleIds, contexts, rules,
    counts: { rules: rules.length, proposedEvidenceStates: Object.fromEntries(["FOUND", "UNCLEAR", "MISSING"].map((state) => [state, rules.filter((rule) => rule.proposedEvidenceState === state).length])) },
  };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion: "rc5-2-maya-batch-3-adjudication-response-v1", document, machineProposalRef: proposalRef, ruleIds: selectedRuleIds, decisionCount: 10 });
  const template = { schemaVersion: "rc5-2-maya-batch-3-adjudication-response-v1", sourceDocument: document, machineProposalRef: proposalRef, decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowHash, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  assertBatch3GeneratedRuleCoverage(template.decisions.map((decision) => decision.stableRuleId), "RC5 Batch 3 template");
  return { packet, schema, template, selectedRuleIds, priorIds, frozen, raw };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifacts = buildArtifacts();
  fs.mkdirSync(packetDir, { recursive: true });
  writeJson(path.join(packetDir, "review-packet.json"), artifacts.packet);
  writeJson(path.join(packetDir, "review-response-schema.json"), artifacts.schema);
  writeJson(path.join(packetDir, "review-template.json"), artifacts.template);
  const manifest = { schemaVersion: "rc5-2-maya-batch-3-adjudication-manifest-v1", generatedAt: "2026-07-17T00:00:00.000Z", sourceCommitSha, sourceDocumentSha256: artifacts.packet.sourceDocument.contentSha256, frozenProposalSha256: artifacts.packet.frozenMachineProposal.sha256, canonicalRawExtractionSha256: artifacts.packet.canonicalRawExtraction.sha256, auditRecordSha256: sha256(fs.readFileSync(auditPath)), selectedRuleIds: artifacts.selectedRuleIds, reviewedRuleIds: artifacts.priorIds, machineRowSha256: Object.fromEntries(artifacts.packet.rules.map((rule) => [rule.stableRuleId, rule.frozenMachineRowHash])), generatedPacketSha256: sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))), packetFiles: ["review-packet.json", "review-response-schema.json", "review-template.json", "review-instructions.md", "agent-prompt.md"] };
  writeJson(path.join(packetDir, "manifest.json"), manifest);
}
