import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-6-full-pdd-expert-review");
const extractionPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
const schemaVersion = "rc5-2-maya-batch-6-full-pdd-expert-review-response-v1";
const ids = [
  "Verra.AFOLU.VM0007.v1-8.R-5-0006",
  "Verra.AFOLU.VM0007.v1-8.R-5-0007",
  "Verra.AFOLU.VM0007.v1-8.R-6-0001",
  "Verra.AFOLU.VM0007.v1-8.R-6-0002",
  "Verra.AFOLU.VM0007.v1-8.R-6-0003",
  "Verra.AFOLU.VM0007.v1-8.R-6-0004",
  "Verra.AFOLU.VM0007.v1-8.R-6-0005",
  "Verra.AFOLU.VM0007.v1-8.R-6-0007",
] as const;

type Page = { pageNumber: number; text: string };
type CandidateSpec = { page: number; heading: string; marker: string; length: number; role: "direct" | "context" | "near_miss"; note: string };
type Candidate = CandidateSpec & { quote: string; spanId: string; documentId: string; documentSha256: string };

const requirements: Record<string, string> = {
  [ids[0]]: "15% threshold at 90% CI. Excess deducted proportionally. Below threshold, no deduction.",
  [ids[1]]: "Period credits = incremental adjusted NER minus buffer withholding.",
  [ids[2]]: "Four mandatory monitoring tasks. Each requires technical description, data list, procedures, QA/QC, archiving, responsibilities.",
  [ids[3]]: "Six required content elements per task.",
  [ids[4]]: "GPS or georeferenced data mandatory. Strata included.",
  [ids[5]]: "Six minimum SOP/QA/QC elements.",
  [ids[6]]: "10-year minimum frequency. Spatial variables must be refreshed.",
  [ids[7]]: "IPCC 2006 expert judgment protocol mandatory. Rationale must be documented.",
};

const specs: Record<string, CandidateSpec[]> = {
  [ids[0]]: [
    { page: 113, heading: "3.2.1.4.2 Step 2: Assess Uncertainty of Emissions and Removals in Project Area", marker: "Table 25. Uncertainty of the baseline rate of deforestation", length: 1050, role: "direct", note: "Uncertainty inputs and baseline-rate table; inspect whether the calculation supports the rule's threshold test." },
    { page: 124, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals", marker: "Once these net GHG emission reductions have been calculated", length: 1250, role: "direct", note: "Explicit 33.1% uncertainty adjustment and the +15% formula; the reviewer must assess the 90% CI and deduction logic." },
    { page: 172, heading: "3.3.2 Data and Parameters Monitored", marker: "The following modified version of equation 22", length: 800, role: "context", note: "Monitoring-table context for the uncertainty-adjusted NER parameter." },
  ],
  [ids[1]]: [
    { page: 124, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals", marker: "To calculate contributions to the AFOLU pooled buffer account", length: 1450, role: "direct", note: "Includes buffer percentage, buffer formula, and distinction from uncertainty/leakage deductions." },
    { page: 125, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals", marker: "Table 29. VCUs per vintage period", length: 1050, role: "direct", note: "Vintage-period inputs and output values for an independent arithmetic check." },
    { page: 171, heading: "3.3.2 Data and Parameters Monitored", marker: "The estimated net GHG emission reductions are based on", length: 1050, role: "direct", note: "NER equation and its baseline, project, and leakage components." },
    { page: 172, heading: "3.3.2 Data and Parameters Monitored", marker: "The following modified version of equation 22", length: 850, role: "direct", note: "Adjusted NER calculation and uncertainty input." },
    { page: 173, heading: "3.3.2 Data and Parameters Monitored", marker: "The following equation is applied", length: 1000, role: "direct", note: "Buffer withholding and VCU equations." },
  ],
  [ids[2]]: [
    { page: 174, heading: "3.3.3 Monitoring Plan", marker: "Following the guidance provided in VMD0015", length: 780, role: "direct", note: "Names all four monitoring tasks and assigns responsibility/frequency." },
    { page: 175, heading: "3.3.3.3.1 Monitoring of forest loss and resulting emissions", marker: "This monitoring task is designed", length: 1450, role: "direct", note: "Task 1 purpose, data, procedures, and QA/QC approach." },
    { page: 178, heading: "3.3.3.3.2 Monitoring areas undergoing natural disturbance and resulting emissions", marker: "Where natural disturbances", length: 1550, role: "direct", note: "Task 2 data, GIS delineation, strata, and procedures." },
    { page: 182, heading: "3.3.3.3.3 Monitoring Non-CO2 Emissions from Biomass Burning", marker: "3.3.3.3.3.1 New data to be collected", length: 1300, role: "direct", note: "Task 3 data and analysis/QA-QC material." },
    { page: 183, heading: "3.3.3.3.4 Monitoring degradation from extraction of trees", marker: "3.3.3.3.4.1 New data to be collected", length: 900, role: "direct", note: "Task 4 data and monitoring scope." },
    { page: 184, heading: "3.3.3.3.4.2 Data collection, analysis, and QA/QC procedures", marker: "Reconnaissance patrols are", length: 1500, role: "direct", note: "Task 4 procedures, SMART recording, SOP trigger, and QA/QC context." },
    { page: 185, heading: "3.3.3.4 Data archiving", marker: "All data collected and documents created", length: 900, role: "direct", note: "Cross-task archiving, geospatial formats, retention, and mirror copy." },
  ],
  [ids[3]]: [
    { page: 175, heading: "3.3.3.3.1.2 Data collection, analysis, and QA/QC procedures", marker: "General approach", length: 1800, role: "direct", note: "Task 1 technical description, data list, procedures, QA/QC, and reporting." },
    { page: 176, heading: "Quality control", marker: "Prior to analysis", length: 1800, role: "direct", note: "Preprocessing, analyst review, statistical accuracy, geodatabase, and metadata elements." },
    { page: 179, heading: "3.3.3.3.2.2 Data collection, analysis, and QA/QC procedures", marker: "identified, a combination of remote sensing", length: 1250, role: "direct", note: "Natural-disturbance procedures and application of field QA/QC." },
    { page: 184, heading: "3.3.3.3.4.2 Data collection, analysis, and QA/QC procedures", marker: "Reconnaissance patrols are", length: 1250, role: "direct", note: "Example task-level data collection, procedure, QA/QC, and SOP treatment." },
    { page: 185, heading: "3.3.3.4 Data archiving", marker: "All data collected and documents created", length: 900, role: "direct", note: "Archiving and retention element shared by monitoring tasks." },
  ],
  [ids[4]]: [
    { page: 175, heading: "3.3.3.3.1.1 New data to be collected", marker: "Geospatial data will be gathered", length: 1250, role: "direct", note: "Explicit geospatial benchmark and monitoring maps." },
    { page: 176, heading: "Quality control", marker: "projection and parameters used to geo-reference", length: 700, role: "direct", note: "Georeferencing metadata and ground-truth coordinates." },
    { page: 178, heading: "3.3.3.3.2.1 New data to be collected", marker: "In situations where the impact", length: 700, role: "direct", note: "Explicit further stratification based on spatially varying carbon stocks." },
    { page: 180, heading: "3.3.3.3.2.2 Data collection, analysis, and QA/QC procedures", marker: "boundaries of a potential new forest stratification", length: 850, role: "direct", note: "Spatial delineation and new-stratum trigger." },
  ],
  [ids[5]]: [
    { page: 176, heading: "Quality control", marker: "Prior to analysis", length: 1800, role: "direct", note: "Preprocessing, analyst review, accuracy assessment, geodatabase, and metadata controls." },
    { page: 177, heading: "3.3.3.3.1 Monitoring of forest loss and resulting emissions", marker: "All work will be conducted by experts", length: 1050, role: "direct", note: "Expert competence, classification classes, and calculation handoff." },
    { page: 179, heading: "3.3.3.3.2.2 Data collection, analysis, and QA/QC procedures", marker: "same QA/QC procedures", length: 800, role: "direct", note: "Cross-reference to field monitoring QA/QC." },
    { page: 184, heading: "3.3.3.3.4.2 Data collection, analysis, and QA/QC procedures", marker: "A detailed standard operating procedure", length: 1000, role: "direct", note: "SOP development and systematic sampling trigger." },
    { page: 185, heading: "3.3.3.5 Procedures for handling non-conformances with the validated monitoring plan", marker: "When non-conformances arise", length: 850, role: "direct", note: "Correction, deviation, and escalation procedures." },
  ],
  [ids[6]]: [
    { page: 154, heading: "3.3.2 Data and Parameters Monitored", marker: "Frequency of\nmonitoring/recording", length: 1150, role: "direct", note: "Benchmark-map frequency and refreshed imagery source." },
    { page: 157, heading: "3.3.2 Data and Parameters Monitored", marker: "Frequency of\nmonitoring/recording", length: 1050, role: "direct", note: "Monitoring-map frequency and changing remote-sensing sources." },
    { page: 174, heading: "3.3.3.2 Frequency of monitoring tasks", marker: "The tasks described below", length: 550, role: "direct", note: "Overall task frequency before verification events." },
    { page: 176, heading: "Quality control", marker: "In subsequent monitored periods", length: 1250, role: "direct", note: "Cross-calibration when spatial data sources change." },
  ],
  [ids[7]]: [
    { page: 132, heading: "3.2.1.2.1 Baseline Pre-Deforestation Carbon Stocks", marker: "Table 4.4 of Volume 4 of IPCC", length: 600, role: "near_miss", note: "IPCC source citation, but no expert-judgment protocol or rationale is stated here." },
    { page: 145, heading: "3.2.1.3 Non-CO2 Emissions from Biomass Burning", marker: "Table 2.6 of Chapter 4 in IPCC", length: 650, role: "near_miss", note: "IPCC parameter source, not the mandatory expert-judgment protocol." },
    { page: 152, heading: "3.2.3.4 STEP 5: Estimate Leakage", marker: "Source of data Expert opinion", length: 600, role: "near_miss", note: "Generic expert opinion is documented, but the required IPCC 2006 protocol and rationale are absent." },
  ],
};

const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function buildCandidate(spec: CandidateSpec, pages: Page[], index: number): Candidate {
  const page = pages.find((candidate) => candidate.pageNumber === spec.page);
  if (!page) throw new Error(`Missing full-PDD page ${spec.page}`);
  const start = page.text.indexOf(spec.marker);
  if (start < 0) throw new Error(`Missing marker on page ${spec.page}: ${spec.marker}`);
  const quote = page.text.slice(start, start + spec.length).trim();
  const spanId = `full-pdd:page-${spec.page}:${index + 1}`;
  return { ...spec, quote, spanId, documentId: document.documentId, documentSha256: document.contentSha256 };
}

export function buildArtifacts() {
  const extraction = read<{ pages: Page[] }>(extractionPath);
  const proposal = read<{ rows: Array<{ stableRuleId: string; [key: string]: unknown }> }>(proposalPath);
  const proposalBytes = fs.readFileSync(proposalPath);
  if (sha256(proposalBytes) !== "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b") throw new Error("Frozen machine proposal changed");
  const extractionSha256 = sha256(fs.readFileSync(extractionPath));
  if (extractionSha256 !== "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8") throw new Error(`Frozen extraction changed: ${extractionSha256}`);
  const proposalRef = { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: sha256(proposalBytes), proposalState: "MACHINE_PROPOSED" as const };
  const contexts: Record<string, unknown> = {};
  const rules = ids.map((stableRuleId) => {
    const row = proposal.rows.find((candidate) => candidate.stableRuleId === stableRuleId);
    if (!row) throw new Error(`Missing frozen row ${stableRuleId}`);
    const candidates = specs[stableRuleId].map((spec, index) => buildCandidate(spec, extraction.pages, index));
    const candidateEvidence = candidates.map((candidate, index) => {
      const contextId = `full-pdd-${stableRuleId.split(".").at(-1)}-${candidate.spanId.replaceAll(":", "-")}`;
      const context = { contextId, documentIdentity: document, pageNumber: candidate.page, sectionHeading: candidate.heading, sourceSpanId: candidate.spanId, exactQuote: candidate.quote, matchFoundInCanonicalExtraction: extraction.pages.find((p) => p.pageNumber === candidate.page)?.text.includes(candidate.quote) === true, surroundingText: { matched: candidate.quote } };
      contexts[contextId] = context;
      return { ...candidate, index, contextId };
    });
    return { stableRuleId, shortRuleId: stableRuleId.split(".").at(-1), requirementText: requirements[stableRuleId], candidateEvidence, historicalMachineContext: { label: "NON_FINAL_MACHINE_CONTEXT", proposedEvidenceState: row.proposedEvidenceStatus, proposedApplicability: row.proposedApplicability, assessmentReason: row.assessmentReason, gap: row.gap }, frozenMachineRowHash: sha256(JSON.stringify(row)) };
  });
  const packet = { schemaVersion: "rc5-2-maya-batch-6-full-pdd-expert-review-packet-v1", reviewPurpose: "Independent expert review using targeted evidence retrieved from the complete frozen Maya PDD extraction. Candidate evidence is unadjudicated and historical machine context is non-final.", sourceDocument: document, canonicalRawExtraction: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: extractionSha256, pageCount: extraction.pages.length, extractionEngine: "pdf-parse" }, frozenMachineProposal: proposalRef, selectedRuleIds: [...ids], contexts, rules, retrievalMethod: { label: "TARGETED_FULL_PDD_RETRIEVAL", searchedPageCount: extraction.pages.length, candidateEvidenceIsUnadjudicated: true, noReviewedTruthCreated: true } };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document, machineProposalRef: proposalRef, ruleIds: [...ids], decisionCount: ids.length });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef: proposalRef, decisions: rules.map((rule) => ({ stableRuleId: rule.stableRuleId, machineRowSha256: rule.frozenMachineRowHash, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  return { packet, schema, template, extractionSha256, proposalSha256: proposalRef.sha256 };
}

export function writeArtifacts(outputDir = packetDir) {
  const artifacts = buildArtifacts();
  fs.mkdirSync(outputDir, { recursive: true });
  write(path.join(outputDir, "review-packet.json"), artifacts.packet);
  write(path.join(outputDir, "review-response-schema.json"), artifacts.schema);
  write(path.join(outputDir, "review-template.json"), artifacts.template);
  const packetBytes = fs.readFileSync(path.join(outputDir, "review-packet.json"));
  write(path.join(outputDir, "manifest.json"), { schemaVersion: "rc5-2-maya-batch-6-full-pdd-expert-review-manifest-v1", generatedAt: "2026-07-18T00:00:00.000Z", sourceCommitSha: "ef7c1445c319f2f9cbb6231d3c2ebd6192a3eaec", sourceDocumentSha256: document.contentSha256, frozenProposalSha256: artifacts.proposalSha256, canonicalRawExtractionSha256: artifacts.extractionSha256, selectedRuleIds: [...ids], generatedPacketSha256: sha256(packetBytes), packetFiles: ["review-packet.json", "review-response-schema.json", "review-template.json"] });
  return artifacts;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
