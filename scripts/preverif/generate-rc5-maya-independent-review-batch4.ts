import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-4");
const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
const proposalPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
export const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
export const excludedBatch3Ids = ["R-2-0008", "R-3-0001", "R-3-0003", "R-3-0004", "R-3-0008", "R-5-0001", "R-5-0003", "R-5-0005"];
export const sourceCommitSha = "38d0ad1aa81d10a1d3648727b7d4114b71dee93a";
const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as T;
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

type Row = Record<string, any> & { stableRuleId: string; reviewStatus?: string };
type Page = { pageNumber: number; text: string };
const short = (id: string) => id.split(".").at(-1)!;
const selectedShortIds = ["R-2-0002", "R-2-0003", "R-2-0004", "R-2-0006", "R-2-0007", "R-2-0013", "R-4-0001"];
export const ids = selectedShortIds.map((id) => `Verra.AFOLU.VM0007.v1-8.${id}`);
const requirements: Record<string, string> = {
  "R-2-0002": "Project boundaries must not overlap another project boundary, subject only to the stated REDD+WRC exception.",
  "R-2-0003": "The project must prevent double counting through external-program and intra-project exclusion tracking.",
  "R-2-0004": "Proxy/reference-region similarity must be justified with the required underlying data and delineation rationale.",
  "R-2-0006": "Combined strata must be justified as materially similar for the required carbon-stock treatment.",
  "R-2-0007": "Carbon-pool inclusion/exclusion must follow the methodology crosswalk and symmetric-accounting requirements.",
  "R-2-0013": "The fixed baseline-modeling period must be identified and applied as required by the methodology.",
  "R-4-0001": "The VT0001 additionality analysis must include the mandatory stepwise analysis, including Step 3 barrier analysis.",
};
const retrievalPages: Record<string, number[]> = {
  "R-2-0002": [78, 81],
  "R-2-0003": [81, 82],
  "R-2-0004": [97, 98, 278],
  "R-2-0006": [25, 104],
  "R-2-0007": [87, 88],
  "R-2-0013": [87, 97, 100, 104, 127],
  "R-4-0001": [86, 91, 92],
};

function inventory() {
  const decisions = truthFiles.flatMap((file) => read<{ decisions: Row[] }>(file).decisions);
  const unique = new Set(decisions.map((row) => row.stableRuleId));
  const reviewed = decisions.filter((row) => row.reviewStatus === "REVIEWED").length;
  const provisional = decisions.filter((row) => row.reviewStatus === "PROVISIONAL").length;
  if (decisions.length !== 58 || unique.size !== 58 || reviewed !== 45 || provisional !== 13) throw new Error(`Unexpected truth inventory ${reviewed}/${provisional}/${unique.size}`);
  const excluded = new Set(excludedBatch3Ids);
  const selected = decisions.filter((row) => row.reviewStatus === "PROVISIONAL" && excluded.has(short(row.stableRuleId)) === false);
  if (selected.length !== 7 || new Set(selected.map((row) => row.stableRuleId)).size !== 7 || selected.map((row) => short(row.stableRuleId)).sort().join(",") !== [...selectedShortIds].sort().join(",")) throw new Error("Batch 4 selection is not exactly seven current non-Batch-3 provisional rules");
  const selectedByShortId = new Map(selected.map((row) => [short(row.stableRuleId), row]));
  return { total: 58, unique: 58, reviewed, provisional, selectedRuleIds: selectedShortIds.map((id) => selectedByShortId.get(id)!.stableRuleId) };
}

export function buildArtifacts() {
  const inv = inventory();
  const extraction = read<{ pages: Page[] }>(extractionPath);
  const proposal = read<{ rows: Row[] }>(proposalPath);
  const methodologyRules = read<Row[]>("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json");
  const extractionSha256 = sha256(fs.readFileSync(path.join(root, extractionPath)));
  const proposalSha256 = sha256(fs.readFileSync(path.join(root, proposalPath)));
  const pddSha256 = sha256(fs.readFileSync(path.join(root, pddPath)));
  if (pddSha256 !== document.contentSha256) throw new Error(`PDD SHA changed: ${pddSha256}`);
  const machineProposalRef = { path: proposalPath, sha256: proposalSha256, proposalState: "MACHINE_PROPOSED" as const };
  const contexts: Record<string, unknown> = {};
  const rules = inv.selectedRuleIds.map((stableRuleId) => {
    const id = short(stableRuleId); const row = proposal.rows.find((candidate) => candidate.stableRuleId === stableRuleId); const contract = methodologyRules.find((candidate) => candidate.id === stableRuleId);
    if (!row || !contract) throw new Error(`Missing frozen row or methodology contract for ${stableRuleId}`);
    const evidence = (retrievalPages[id] ?? []).map((pageNumber, index) => { const page = extraction.pages.find((candidate) => candidate.pageNumber === pageNumber); if (!page) throw new Error(`Missing PDD page ${pageNumber}`); const spanId = `full-pdd:page-${pageNumber}:${index + 1}`; const contextId = `full-pdd-${id}-${index + 1}`; const context = { contextId, documentIdentity: document, pageNumber, sectionHeading: page.text.split("\n").filter(Boolean).slice(0, 3).join(" "), sourceSpanId: spanId, exactQuote: page.text, surroundingText: { completePageText: page.text }, includesTablesEquationsAppendicesAndCrossReferences: true, fullPageTextAvailableInCanonicalExtraction: true }; contexts[contextId] = context; return { quote: page.text, page: pageNumber, sectionHeading: context.sectionHeading, spanId, contextId, documentId: document.documentId, documentSha256: document.contentSha256, role: "direct", note: "Complete canonical extraction page retained to preserve surrounding paragraphs, tables, equations, and cross-references." }; });
    return { stableRuleId, shortRuleId: id, requirementText: requirements[id], machineProposalSummary: { evidenceState: row.proposedEvidenceStatus, applicability: row.proposedApplicability, outcome: row.upstreamStatus }, methodologyContract: { ...contract, contractText: contract.source_span_text, contractTextSha256: sha256(contract.source_span_text ?? ""), sha256: sha256(JSON.stringify(contract)) }, candidateEvidence: evidence, existingAcceptedEvidence: row.acceptedEvidence ?? [], existingRejectedEvidence: row.rejectedEvidence ?? [], historicalMachineContext: { proposedAcceptedEvidence: row.proposedAcceptedEvidence ?? null, proposedRejectedEvidence: row.proposedRejectedEvidence ?? null, assessmentReason: row.assessmentReason, gap: row.gap, clientAction: row.clientAction }, frozenMachineRow: row, frozenMachineRowSha256: sha256(JSON.stringify(row)) };
  });
  const packet = { schemaVersion: "rc5-2-maya-independent-review-batch-4-packet-v1", reviewPurpose: "Frozen independent review of exactly seven current non-Batch-3 Maya provisional rules. No reviewed truth is embedded or changed.", sourceDocument: document, canonicalRawExtraction: { path: extractionPath, sha256: extractionSha256, pageCount: extraction.pages.length, extractionEngine: "pdf-parse" }, frozenPddPdf: { path: pddPath, sha256: pddSha256 }, frozenMachineProposal: machineProposalRef, selectedRuleIds: inv.selectedRuleIds, contexts, rules, explicitMissingSources: ["Boundary KML and shapefiles referenced by the PDD are not included in the frozen source set.", "Intra-project exclusion tracking evidence is not included in the frozen source set.", "The underlying LIC/RRD source data and Appendix XYZ are not included in the frozen source set.", "Appendices 21 and 22 and the methodology pool crosswalk inputs are not included in the frozen source set.", "The PDD does not include a VT0001 Step 3 barrier-analysis decision tree or underlying barrier evidence."], retrievalMethod: { label: "TARGETED_FULL_PDD_RETRIEVAL", searchedPageCount: extraction.pages.length, completePagesRetained: true, surroundingParagraphsTablesEquationsAppendicesAndCrossReferencesIncluded: true, existingAcceptedAndRejectedEvidenceRetained: true, candidateEvidenceIsUnadjudicated: true, noReviewedTruthCreated: true }, frozenInventory: inv };
  const schemaVersion = "rc5-2-maya-independent-review-batch-4-response-v1";
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document, machineProposalRef, ruleIds: inv.selectedRuleIds, decisionCount: 7 });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef, decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowSha256, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  return { packet, schema, template, sourcePins: { pddSha256, extractionSha256, proposalSha256, methodologyRulesSha256: sha256(fs.readFileSync(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json"))), methodologySectionsSha256: sha256(fs.readFileSync(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json"))), reviewedTruthSha256: Object.fromEntries(truthFiles.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))])) } };
}

export function writeArtifacts(outputDir = packetDir) { const a = buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true }); write(path.join(outputDir, "review-packet.json"), a.packet); write(path.join(outputDir, "review-response-schema.json"), a.schema); write(path.join(outputDir, "review-template.json"), a.template); const files = ["review-packet.json", "review-response-schema.json", "review-template.json"]; write(path.join(outputDir, "manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-4-manifest-v1", sourceCommitSha, selectedRuleIds: a.packet.selectedRuleIds, sourceArtifacts: { pddPdf: { path: pddPath, sha256: a.sourcePins.pddSha256 }, canonicalExtraction: { path: extractionPath, sha256: a.sourcePins.extractionSha256 }, machineProposal: { path: proposalPath, sha256: a.sourcePins.proposalSha256 }, methodologyRules: { path: "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json", sha256: a.sourcePins.methodologyRulesSha256 }, methodologySections: { path: "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json", sha256: a.sourcePins.methodologySectionsSha256 }, reviewedTruth: a.sourcePins.reviewedTruthSha256 }, generatedFiles: Object.fromEntries(files.map((file) => [file, sha256(fs.readFileSync(path.join(outputDir, file)))])), inventory: a.packet.frozenInventory, reviewedTruthEmbeddedAsAnswer: false, generatedAt: "2026-07-19T00:00:00.000Z" }); return a; }
if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
