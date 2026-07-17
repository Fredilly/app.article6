import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-2-adjudication");
const frozenPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const auditPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/audit-record.json");
const rawPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const priorPacketPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication/review-packet.json");
const priorResponsePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-adjudication-response.json");
const priorComparisonPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json");

function readJson<T>(filePath: string): T { return JSON.parse(fs.readFileSync(filePath, "utf8")) as T; }
function sha256(value: string | Buffer): string { return crypto.createHash("sha256").update(value).digest("hex"); }
function writeJson(filePath: string, value: unknown): void { fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

type Evidence = { quote: string; page: number; section: string; spanId: string; evidenceType?: string; rejectionReason?: string; provenance: Record<string, unknown> };
type FrozenRow = Record<string, any> & { stableRuleId: string; rowSha256: string };

function buildContext(evidence: Evidence, pages: Array<{ pageNumber: number; text: string }>, contextId: string) {
  const heading = String(evidence.provenance.sectionHeading ?? evidence.section ?? "");
  const normalizedHeading = heading.toLowerCase().replace(/\s+/g, " ").trim();
  const located = pages.find((page) => page.text.toLowerCase().replace(/\s+/g, " ").includes(normalizedHeading));
  const text = located?.text ?? pages[0]?.text ?? "";
  const index = normalizedHeading ? text.toLowerCase().replace(/\s+/g, " ").indexOf(normalizedHeading) : 0;
  const start = Math.max(0, index < 0 ? 0 : index);
  return {
    contextId,
    documentIdentity: {
      documentId: "quick-check-review-question",
      documentName: "12-maya-forest-corridor-redd-belize.pdf",
      contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
    },
    pageNumber: located?.pageNumber ?? evidence.page,
    sectionHeading: heading,
    sourceSpanId: evidence.spanId,
    exactQuote: evidence.quote,
    matchFoundInCanonicalExtraction: text.includes(evidence.quote),
    surroundingText: {
      before: text.slice(Math.max(0, start - 1800), start),
      matched: evidence.quote,
      after: text.slice(start + Math.min(heading.length, text.length), start + Math.min(heading.length, text.length) + 1800),
    },
  };
}

function evidenceReference(evidence: Evidence, contextId: string, index: number) {
  return {
    index,
    contextId,
    documentIdentity: {
      documentId: "quick-check-review-question",
      documentName: "12-maya-forest-corridor-redd-belize.pdf",
      contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
    },
    provenance: evidence.provenance,
  };
}

export function buildArtifacts() {
  const frozen = readJson<{ rows: FrozenRow[]; sourceDocument: Record<string, unknown>; proposalState: string; auditId: string }>(frozenPath);
  const audit = readJson<Record<string, unknown>>(auditPath);
  const raw = readJson<{ pages: Array<{ pageNumber: number; text: string }> }>(rawPath);
  const priorPacket = readJson<{ rules: Array<{ stableRuleId: string }> }>(priorPacketPath);
  const priorResponse = readJson<{ decisions: Array<{ stableRuleId: string }> }>(priorResponsePath);
  const priorComparison = readJson<{ rows: Array<{ stableRuleId: string }> }>(priorComparisonPath);

  const priorIds = [...new Set([...priorPacket.rules, ...priorResponse.decisions, ...priorComparison.rows].map((row) => row.stableRuleId))];
  const priorSet = new Set(priorIds);
  const selected = frozen.rows.map((row, index) => ({ row, canonicalPosition: index + 1 })).filter(({ row }) => !priorSet.has(row.stableRuleId)).slice(0, 10);
  if (selected.length !== 10) throw new Error(`Expected 10 selected rows, got ${selected.length}`);
  if (selected.some(({ row }) => priorSet.has(row.stableRuleId))) throw new Error("Selected rule overlaps prior review");

  const contexts: Record<string, unknown> = {};
  const rules = selected.map(({ row, canonicalPosition }) => {
    const accepted = row.acceptedEvidence as Evidence[];
    const rejected = row.rejectedEvidence as Evidence[];
    const refs = { accepted: [] as unknown[], rejected: [] as unknown[] };
    const addEvidence = (items: Evidence[], kind: "accepted" | "rejected") => items.map((evidence, index) => {
      const contextId = `batch2-${row.stableRuleId.split(".").at(-1)}-${kind}-${index + 1}`;
      contexts[contextId] = buildContext(evidence, raw.pages, contextId);
      refs[kind].push(evidenceReference(evidence, contextId, index));
      return contextId;
    });
    const acceptedContextIds = addEvidence(accepted, "accepted");
    const rejectedContextIds = addEvidence(rejected, "rejected");
    const primaryContextId = acceptedContextIds[0] ?? rejectedContextIds[0] ?? null;
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
      machineAssessment: {
        assessmentReason: row.assessmentReason,
        gap: row.gap,
        clientAction: row.clientAction,
        componentCoverage: row.componentCoverage,
        contradictions: row.contradictions,
        confidence: row.confidence,
      },
      exactFrozenMachineRow: row,
      frozenMachineRowHash: sha256(JSON.stringify(row)),
      sourceContext: { primaryContextId, evidenceContextRefs: refs },
    };
  });
  const selectedRuleIds = selected.map(({ row }) => row.stableRuleId);
  assertRc5RuleCoverage(selectedRuleIds, selected.map(({ row }) => row.stableRuleId), "RC5 Batch 2 selection");
  const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
  const packet = {
    schemaVersion: "rc5-2-maya-batch-2-adjudication-review-packet-v1",
    reviewPurpose: "Independent adjudication of the next ten unreviewed frozen Maya machine-proposed rules.",
    sourceDocument: document,
    frozenMachineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: sha256(fs.readFileSync(frozenPath)), proposalState: frozen.proposalState, auditId: frozen.auditId },
    canonicalRawExtraction: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: sha256(fs.readFileSync(rawPath)), pageCount: raw.pages.length, extractionEngine: "pdf-parse" },
    reviewedRuleExclusion: { derivation: "Union of stableRuleId values from the prior packet rules, completed adjudication response decisions, and reviewed-comparison rows.", artifacts: ["docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication/review-packet.json", "docs/roadmaps/interactive-evidence-review-mvp/rc5/maya-adjudication-response.json", "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-reviewed-comparison/machine-vs-review-comparison.json"], reviewedRuleIds: frozen.rows.map((row) => row.stableRuleId).filter((id) => priorSet.has(id)) },
    selectedRuleIds,
    contexts,
    rules,
    counts: { rules: rules.length, proposedEvidenceStates: Object.fromEntries(["FOUND", "UNCLEAR", "MISSING"].map((state) => [state, rules.filter((rule) => rule.proposedEvidenceState === state).length])) },
  };
  const schema = buildRc5AdjudicationResponseSchema({
    schemaVersion: "rc5-2-maya-batch-2-adjudication-response-v1",
    document,
    machineProposalRef: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: sha256(fs.readFileSync(frozenPath)), proposalState: "MACHINE_PROPOSED" },
    ruleIds: selectedRuleIds,
    decisionCount: 10,
  });
  const template = { schemaVersion: "rc5-2-maya-batch-2-adjudication-response-v1", sourceDocument: document, machineProposalRef: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: sha256(fs.readFileSync(frozenPath)), proposalState: "MACHINE_PROPOSED" }, decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowHash, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, provisionalReason: null, genericFailureCategory: null, reviewerConfidence: null })) };
  return { packet, schema, template, selectedRuleIds, priorIds, frozen, audit, raw };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifacts = buildArtifacts();
  fs.mkdirSync(packetDir, { recursive: true });
  writeJson(path.join(packetDir, "review-packet.json"), artifacts.packet);
  writeJson(path.join(packetDir, "review-response-schema.json"), artifacts.schema);
  writeJson(path.join(packetDir, "review-template.json"), artifacts.template);
  const manifest = { schemaVersion: "rc5-2-maya-batch-2-adjudication-manifest-v1", generatedAt: "2026-07-17T00:00:00.000Z", sourceCommitSha: "0747920e839011e908d78e0d9280da13c5a7c85c", sourceDocumentSha256: artifacts.packet.sourceDocument.contentSha256, frozenProposalSha256: artifacts.packet.frozenMachineProposal.sha256, canonicalRawExtractionSha256: artifacts.packet.canonicalRawExtraction.sha256, auditRecordSha256: sha256(fs.readFileSync(auditPath)), selectedRuleIds: artifacts.selectedRuleIds, reviewedRuleIds: artifacts.priorIds, generatedPacketSha256: sha256(fs.readFileSync(path.join(packetDir, "review-packet.json"))), packetFiles: ["review-packet.json", "review-response-schema.json", "review-template.json", "review-instructions.md", "agent-prompt.md"] };
  writeJson(path.join(packetDir, "manifest.json"), manifest);
}
