import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-wave-1-pdd-finality");
export const baseCommitSha = "39ff42ecdb102d98ad4801c2cd483f43d75b8f32";
export const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
export const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
export const machinePath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const officialPdfPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf";
export const officialPagesPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json";
export const methodologyRulesPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json";
export const methodologySectionsPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json";
export const reviewedTruthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const selectedRuleIds = ["R-2-0007", "R-2-0008", "R-3-0001", "R-3-0003", "R-3-0004", "R-3-0008", "R-4-0001", "R-5-0003"].map((id) => `Verra.AFOLU.VM0007.v1-8.${id}`);
export const excludedRuleIds = ["R-2-0002", "R-2-0004"].map((id) => `Verra.AFOLU.VM0007.v1-8.${id}`);
export const excludedRuleReasons: Record<string, string> = {
  "Verra.AFOLU.VM0007.v1-8.R-2-0002": "Genuinely dependent on absent client-controlled boundary KML and shapefiles needed to determine geometric exclusivity.",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004": "Genuinely dependent on absent LIC parcel/source data and RRD supporting material needed to determine the reference-region delineation.",
};
const expectedSourceSha256 = {
  pdd: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
  extraction: "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8",
  machine: "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b",
  officialPdf: "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6",
  officialPages: "80164150eeb7fa8eb916c73bbcdab0cc0b79d49d544dc9c28cef7c61a8166561",
  methodologyRules: "",
  methodologySections: "",
};
const expectedReviewedTruthSha256: Record<string, string> = {
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json": "f172fbf723fd002a9cb1bae54c140d0adbbbd4c5b06e616a6eed05ac5f606dd2",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-2-adjudication/reviewed-truth.json": "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json": "e52938d489ae0f106fdfccfe9d81a90386e8d2e55925759aa2700145bf82086b",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication/reviewed-truth.json": "85dede541c31c4269e25ac15782d6cdcde5e15e304382768a3603e90e2c7ff3d",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication/reviewed-truth.json": "4aa43b1e1587e6c90deee6875aed2bf26ffdf9e6f5e741e559a5145a9d44e9d5",
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-adjudication/reviewed-truth.json": "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
};
const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;
const short = (id: string) => id.split(".").at(-1)!;
type AnyRow = Record<string, any> & { stableRuleId: string; reviewStatus?: string };
type Page = { pageNumber: number; text: string };

const pddPages: Record<string, number[]> = {
  "R-2-0007": [87, 88], "R-2-0008": [87, 88], "R-3-0001": [86, 91, 92], "R-3-0003": [91, 92],
  "R-3-0004": [92], "R-3-0008": [14, 86, 92], "R-4-0001": [86, 91, 92], "R-5-0003": [86, 88, 123],
};
const officialPages: Record<string, number[]> = {
  "R-2-0007": [23, 24, 30], "R-2-0008": [23, 24, 30], "R-3-0001": [25, 26, 27, 28], "R-3-0003": [25, 26, 27],
  "R-3-0004": [26, 27], "R-3-0008": [27], "R-4-0001": [25, 26, 27, 28], "R-5-0003": [30, 33],
};
const questions: Record<string, string> = {
  "R-2-0007": "Using the frozen evidence and contract, is the carbon-pool inclusion/exclusion requirement finally demonstrated, finally not demonstrated, not applicable, or still provisional?",
  "R-2-0008": "Using the frozen evidence and contract, what final evidence state and applicability conclusion, if any, is defensible for the conditional HWP/dead-wood requirement?",
  "R-3-0001": "Does the frozen PDD and committed methodology text establish a complete VT0001-based additionality/baseline pathway for this requirement?",
  "R-3-0003": "Does the frozen evidence establish the required ordering and use of barrier analysis versus investment analysis or the qualitative fallback?",
  "R-3-0004": "Does the frozen PDD document enough of the VT0001 Option I/II/III criteria and selection logic for a final conclusion?",
  "R-3-0008": "Is jurisdictional baseline data within scope of this requirement for the project on the frozen evidence and methodology text?",
  "R-4-0001": "Does the frozen PDD satisfy the VT0001 additionality requirement when read with the committed official methodology text, including the conditional Step 3 logic?",
  "R-5-0003": "Is ecological/WRC leakage applicable to this project under the frozen PDD scope and committed methodology text, and is the requirement finally addressed?",
};
const missingSources: Record<string, string[]> = {
  "R-2-0007": ["Appendices 21 and 22 and any external pool-calculation workbooks referenced by the PDD are not in the frozen source set."],
  "R-2-0008": ["Appendices 21 and 22 and the referenced significance-test tab are not in the frozen source set."],
  "R-3-0001": ["Appendix 17 project-cost supporting material is referenced by the PDD but is not in the frozen source set."],
  "R-3-0003": ["No separate client attachment containing a VT0001 decision-tree worksheet is in the frozen source set; the PDD and official methodology passages are included for finality review."],
  "R-3-0004": ["No separate client attachment containing an Option I/II/III worksheet is in the frozen source set; the PDD and official methodology passages are included for finality review."],
  "R-3-0008": ["No separate jurisdictional baseline dataset is in the frozen source set; the committed methodology text and PDD scope statements are included."],
  "R-4-0001": ["No separate VT0001 Step 3 worksheet is in the frozen source set; the official VM0007 conditional Step 3 text is included."],
  "R-5-0003": ["No separate WRC project attachment is in the frozen source set; the PDD scope and official leakage-module applicability text are included."],
};

function inventory() {
  const decisions = reviewedTruthFiles.flatMap((file) => read<{ decisions: AnyRow[] }>(file).decisions);
  const ids = new Set(decisions.map((row) => row.stableRuleId));
  if (decisions.length !== 58 || ids.size !== 58) throw new Error(`Unexpected source inventory ${decisions.length}/${ids.size}`);
  if (decisions.filter((row) => row.reviewStatus === "REVIEWED").length !== 48 || decisions.filter((row) => row.reviewStatus === "PROVISIONAL").length !== 10) throw new Error("Expected 48 REVIEWED and 10 PROVISIONAL");
  const provisional = new Set(decisions.filter((row) => row.reviewStatus === "PROVISIONAL").map((row) => row.stableRuleId));
  if (new Set([...selectedRuleIds, ...excludedRuleIds]).size !== 10 || ![...selectedRuleIds, ...excludedRuleIds].every((id) => provisional.has(id))) throw new Error("Wave 1 is not exactly the current provisional union");
  const mechanicallyDerivedSelected = [...provisional].filter((id) => !excludedRuleIds.includes(id)).sort();
  if (mechanicallyDerivedSelected.join(",") !== [...selectedRuleIds].sort().join(",")) throw new Error("Wave 1 selected IDs are not mechanically derived from provisional IDs minus exclusions");
  if (selectedRuleIds.some((id) => decisions.find((row) => row.stableRuleId === id)?.reviewStatus !== "PROVISIONAL")) throw new Error("Reviewed rule selected");
  return { totalRules: 58, uniqueRuleCount: 58, reviewedRuleCount: 48, provisionalRuleCount: 10, provisionalRuleIds: [...provisional].sort(), selectedRuleIds, excludedRuleIds };
}

function evidenceForPages(pages: Page[], ruleId: string) {
  return (pddPages[short(ruleId)] ?? []).map((pageNumber, index) => {
    const page = pages.find((candidate) => candidate.pageNumber === pageNumber);
    if (!page) throw new Error(`Missing PDD page ${pageNumber}`);
    const spanId = `full-pdd:page-${pageNumber}:${index + 1}`;
    return { quote: page.text, page: pageNumber, sectionHeading: page.text.split("\n").filter(Boolean).slice(0, 3).join(" "), spanId, documentId: document.documentId, documentSha256: document.contentSha256, role: "direct", note: "Complete canonical PDD page retained for independent review." };
  });
}
const machineOnlyFields = ["rowId", "auditId", "stableRuleId", "ruleReference", "ruleTitle", "requirementText", "methodologyId", "methodologyVersion", "rawAuditStatus", "upstreamStatus", "proposedEvidenceStatus", "proposedApplicability", "proposedAcceptedEvidence", "proposedRejectedEvidence", "acceptedEvidence", "rejectedEvidence", "sourceDocument", "quote", "page", "section", "spanId", "provenance", "proposalSource", "proposalTimestamp"];
function machineProjection(row: AnyRow) { return Object.fromEntries(machineOnlyFields.filter((field) => field in row).map((field) => [field, row[field]])); }

export function buildArtifacts() {
  const frozenInventory = inventory();
  const extraction = read<{ pages: Page[] }>(extractionPath);
  const pagesArtifact = read<{ sourcePdfSha256: string; pages: Array<{ pageNumber: number; text: string }> }>(officialPagesPath);
  const actualSources = { pdd: sha256(fs.readFileSync(pddPath)), extraction: sha256(fs.readFileSync(extractionPath)), machine: sha256(fs.readFileSync(machinePath)), officialPdf: sha256(fs.readFileSync(officialPdfPath)), officialPages: sha256(fs.readFileSync(officialPagesPath)), methodologyRules: sha256(fs.readFileSync(path.join(root, methodologyRulesPath))), methodologySections: sha256(fs.readFileSync(path.join(root, methodologySectionsPath))) };
  if (actualSources.methodologyRules !== "9fceaa1dc458c847c1236fad73215f56b924ebbec794850b60c0510ace7d0e49" || actualSources.methodologySections !== "4506bb488417a940fc4e84228bff7abcc7e7921fcb9a824fa140bf6e2687b5e3") throw new Error("Methodology source SHA changed");
  if (actualSources.pdd !== expectedSourceSha256.pdd || actualSources.extraction !== expectedSourceSha256.extraction || actualSources.machine !== expectedSourceSha256.machine || actualSources.officialPdf !== expectedSourceSha256.officialPdf || actualSources.officialPages !== expectedSourceSha256.officialPages || reviewedTruthFiles.some((file) => sha256(fs.readFileSync(path.join(root, file))) !== expectedReviewedTruthSha256[file])) throw new Error("Frozen source SHA changed");
  if (pagesArtifact.sourcePdfSha256 !== actualSources.officialPdf) throw new Error("Official methodology pages/PDF SHA mismatch");
  const machine = read<{ rows: AnyRow[] }>(machinePath);
  const reviewed = reviewedTruthFiles.flatMap((file) => read<{ decisions: AnyRow[] }>(file).decisions);
  const contracts = read<AnyRow[]>(methodologyRulesPath);
  const rules = selectedRuleIds.map((stableRuleId) => {
    const decision = reviewed.find((row) => row.stableRuleId === stableRuleId)!;
    const row = machine.rows.find((candidate) => candidate.stableRuleId === stableRuleId);
    const contract = contracts.find((candidate) => candidate.id === stableRuleId);
    if (!row || !contract || decision.reviewStatus !== "PROVISIONAL") throw new Error(`Missing frozen source for ${stableRuleId}`);
    return { stableRuleId, methodologyContract: { ...contract, exactContractHash: sha256(JSON.stringify(contract)) }, frozenMachineRow: machineProjection(row), machineRowSha256: sha256(JSON.stringify(row)), currentMachineOnlySummary: { proposedEvidenceStatus: row.proposedEvidenceStatus, proposedApplicability: row.proposedApplicability, upstreamStatus: row.upstreamStatus }, fullRelevantPddPageContexts: evidenceForPages(extraction.pages, stableRuleId), candidateEvidence: decision.acceptedEvidence.concat(decision.rejectedEvidence), existingAcceptedEvidence: decision.acceptedEvidence, existingRejectedEvidence: decision.rejectedEvidence, officialMethodologyToolPassages: (officialPages[short(stableRuleId)] ?? []).map((pageNumber) => { const page = pagesArtifact.pages.find((candidate) => candidate.pageNumber === pageNumber); if (!page) throw new Error(`Missing official page ${pageNumber}`); return { pageNumber, exactPassage: page.text, sourcePath: officialPagesPath, sourcePdfSha256: pagesArtifact.sourcePdfSha256, passageSha256: sha256(page.text) }; }), explicitMissingSources: missingSources[short(stableRuleId)], neutralReviewQuestion: questions[short(stableRuleId)] };
  });
  const packet = { schemaVersion: "rc5-2-maya-wave-1-pdd-finality-packet-v1", reviewPurpose: "Frozen independent finality reassessment of exactly the mechanically selected Maya provisional rules. Reviewed truth is not embedded as an answer.", sourceDocument: document, frozenFullPdd: { path: pddPath, sha256: sha256(fs.readFileSync(pddPath)) }, canonicalExtraction: { path: extractionPath, sha256: sha256(fs.readFileSync(extractionPath)), pageCount: extraction.pages.length }, frozenMachineProposal: { path: machinePath, sha256: sha256(fs.readFileSync(machinePath)), proposalState: "MACHINE_PROPOSED" }, selectedRuleIds, rules, frozenInventory, reviewOutcomeOptions: ["REVIEWED", "PROVISIONAL"], allowedFinalConclusions: ["FOUND", "UNCLEAR", "MISSING", "N/A", "ACTION_REQUIRED", "NOT_APPLICABLE"] };
  const schemaVersion = "rc5-2-maya-wave-1-pdd-finality-response-v1";
  const machineRef = { path: machinePath, sha256: sha256(fs.readFileSync(machinePath)), proposalState: "MACHINE_PROPOSED" as const };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document, machineProposalRef: machineRef, ruleIds: selectedRuleIds, decisionCount: selectedRuleIds.length });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef: machineRef, decisions: selectedRuleIds.map((stableRuleId) => ({ stableRuleId, machineRowSha256: sha256(JSON.stringify(machine.rows.find((row) => row.stableRuleId === stableRuleId))), reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: false, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  const sourceArtifacts = { mainBaseCommitSha: baseCommitSha, pdd: { path: pddPath, sha256: actualSources.pdd }, extraction: { path: extractionPath, sha256: actualSources.extraction }, machineProposal: machineRef, officialMethodologyPdf: { path: officialPdfPath, sha256: actualSources.officialPdf }, officialMethodologyPages: { path: officialPagesPath, sha256: actualSources.officialPages }, methodologyRules: { path: methodologyRulesPath, sha256: actualSources.methodologyRules }, methodologySections: { path: methodologySectionsPath, sha256: actualSources.methodologySections }, reviewedTruthForSelectionOnly: Object.fromEntries(reviewedTruthFiles.map((file) => [file, sha256(fs.readFileSync(path.join(root, file)))])) };
  return { packet, schema, template, sourceArtifacts };
}

export function writeArtifacts(outputDir = packetDir) { const artifacts = buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true }); for (const [file, value] of Object.entries({ "review-packet.json": artifacts.packet, "review-response-schema.json": artifacts.schema, "review-template.json": artifacts.template })) fs.writeFileSync(path.join(outputDir, file), `${JSON.stringify(value, null, 2)}\n`); fs.writeFileSync(path.join(outputDir, "reviewer-instructions.md"), "# Independent review instructions\n\nReview each selected rule independently using only the frozen packet. Return one decision per stableRuleId. A rule may be REVIEWED with any final conclusion, including MISSING or UNCLEAR; REVIEWED does not mean CONFORMS. Return PROVISIONAL only when the packet leaves a genuinely unavailable source or unresolved interpretation necessary for finality. Do not import current human judgments or expected answers.\n"); const generatedFiles = ["review-packet.json", "review-response-schema.json", "review-template.json", "reviewer-instructions.md"]; const manifest = { schemaVersion: "rc5-2-maya-wave-1-pdd-finality-manifest-v1", sourceArtifacts: artifacts.sourceArtifacts, selectedRuleIds, excludedRuleIds, excludedRuleReasons, generatedFiles: Object.fromEntries(generatedFiles.map((file) => [file, sha256(fs.readFileSync(path.join(outputDir, file)))])), reviewedTruthEmbeddedAsAnswer: false, statement: "Reviewed truth is used only for mechanical Wave 1 rule selection and is not embedded as an answer.", inventory: artifacts.packet.frozenInventory }; fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`); return { ...artifacts, manifest }; }

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
