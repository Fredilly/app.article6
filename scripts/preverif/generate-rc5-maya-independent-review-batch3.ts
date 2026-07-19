import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-independent-review-batch-3");
const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
const proposalPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
export const ids = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0008", "Verra.AFOLU.VM0007.v1-8.R-3-0001", "Verra.AFOLU.VM0007.v1-8.R-3-0003", "Verra.AFOLU.VM0007.v1-8.R-3-0004",
  "Verra.AFOLU.VM0007.v1-8.R-3-0008", "Verra.AFOLU.VM0007.v1-8.R-5-0001", "Verra.AFOLU.VM0007.v1-8.R-5-0003", "Verra.AFOLU.VM0007.v1-8.R-5-0005",
] as const;
const schemaVersion = "rc5-2-maya-independent-review-batch-3-response-v1";
const sourceCommitSha = "95bf3b6edced35a466673fa7c0e950cdfd5aa738";
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8")) as T;
const write = (p: string, v: unknown) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
type Page = { pageNumber: number; text: string };
type Spec = { page: number; heading: string; marker: string; length: number; role: "direct" | "context" | "conflicting_or_insufficient"; note: string };
type Evidence = { quote: string; page: number; sectionHeading: string; spanId: string; documentId: string; documentSha256: string; role: Spec["role"]; note: string };

const requirements: Record<string, string> = {
  [ids[0]]: "AGB is mandatory; HWP and dead wood are conditional on the applicable baseline/project comparison and significance treatment.",
  [ids[1]]: "VT0001 is mandatory for the applicable non-tidal-wetland activity pathway; use its stepwise additionality analysis to identify the most plausible baseline.",
  [ids[2]]: "Where VT0001 barrier analysis is used, apply its decision tree to alternatives not prevented by a barrier.",
  [ids[3]]: "Where VT0001 investment analysis is used, select the baseline using the applicable Option I, II, or III criteria.",
  [ids[4]]: "Conservative jurisdictional-baseline data may be used when it meets VCS JNR Requirements, even if accuracy is less stringent.",
  [ids[5]]: "REDD net reductions equal baseline emissions minus project emissions minus leakage, with each component defined and quantified.",
  [ids[6]]: "Leakage must be considered for all activities using the activity-shifting, market-effects, or ecological leakage modules applicable to the activity.",
  [ids[7]]: "The AFOLU pooled-buffer contribution is calculated from the relevant baseline/project carbon-stock benefit and the buffer percentage; leakage and uncertainty are excluded from that calculation.",
};
const blockers: Record<string, string> = {
  [ids[0]]: "Methodology-expert interpretation is required to determine whether VM0007's conditional HWP branch is triggered by this planned-deforestation REDD project and whether the PDD's de minimis treatment is sufficient without the cited Appendix 21/22 workbooks.",
  [ids[1]]: "The PDD presents Step 1 and a high-level VT0001 applicability statement, but the reviewer must determine whether the full VT0001 analysis is complete and consistent with the methodology's mandatory stepwise chain.",
  [ids[2]]: "The PDD states that a simple cost analysis was selected and refers to Appendix 17, but the underlying costs and a barrier decision-tree analysis are not included in the frozen source set.",
  [ids[3]]: "The PDD identifies Option 1 and provides a narrative conclusion, but the underlying project-cost evidence in Appendix 17 is absent and Options II/III are not analyzed; independent review must test whether Option 1 is permissible.",
  [ids[4]]: "The PDD expressly says it is not inside a jurisdiction covered by a jurisdictional REDD+ program; no JNR baseline dataset or applicability chain is supplied, so the rule may be inapplicable but requires expert confirmation.",
  [ids[5]]: "The PDD contains the equation, component definitions, project-scenario zero statement, and baseline/leakage calculations, but source spreadsheet Appendix 22 is absent and the applied values cannot be independently recomputed from the frozen PDD alone.",
  [ids[6]]: "The PDD quantifies planned-deforestation activity-shifting leakage and its inputs, but the methodology-level all-activity module selection and any market-effects treatment require independent cross-reference to the frozen methodology contract.",
  [ids[7]]: "The PDD contains the buffer equation and 12.0% value, but the AFOLU Non-Permanence Risk Tool result and source calculations are not included; the reviewer must verify the risk-derived percentage and scope of the baseline term.",
};
const specs: Record<string, Spec[]> = {
  [ids[0]]: [
    { page: 87, heading: "3.1.3.3 Carbon pools", marker: "The following carbon pools are accounted for", length: 1250, role: "direct", note: "Full pool list, HWP/dead-wood treatment, significance references, and cross-scenario accounting." },
    { page: 88, heading: "3.1.3.3 Carbon pools", marker: "belowground palm biomass are excluded", length: 1150, role: "direct", note: "Explicit de minimis rationale, Appendix 21/22 references, dead-wood inclusion, and HWP leakage treatment." },
    { page: 88, heading: "3.1.3.4 Sources of GHG Emissions", marker: "Table 12. Source of GHG emissions included in the MFC REDD project", length: 1150, role: "context", note: "Pool/source table context for baseline and project comparison." },
  ],
  [ids[1]]: [
    { page: 86, heading: "3.1.2 Applicability of Methodology (VCS, 3.1)", marker: "VT0001 AFOLU activities", length: 1050, role: "direct", note: "VT0001 applicability conditions and stepwise-baseline justification." },
    { page: 91, heading: "3.1.5.2.1 Step 1: Identification of alternative land use scenarios to the proposed AFOLU Project activity.", marker: "There are three credible alternative land use scenarios", length: 1750, role: "direct", note: "Step 1 alternatives A/B/C, legality, and the start of the baseline selection chain." },
    { page: 92, heading: "3.1.5.2.2 Step 2. Investment Analysis", marker: "Because the Project generates no financial or economic benefits", length: 950, role: "direct", note: "Step 2 method selection and explicit Appendix 17 cross-reference." },
  ],
  [ids[2]]: [
    { page: 91, heading: "3.1.5.2.1 Step 1: Identification of alternative land use scenarios to the proposed AFOLU Project activity.", marker: "Sub-step 1b. Consistency of credible land use scenarios with enforced mandatory laws and regulations.", length: 1450, role: "context", note: "Alternative list and legal consistency immediately preceding selection." },
    { page: 92, heading: "3.1.5.2.2 Step 2. Investment Analysis", marker: "Sub-step 2a. Determine appropriate analysis method", length: 950, role: "direct", note: "The PDD selects simple cost analysis rather than presenting a barrier decision tree." },
    { page: 278, heading: "Appendix 4: Commercially Sensitive Information", marker: "The original data provided by LIC can be found in Appendix XYZ", length: 520, role: "conflicting_or_insufficient", note: "Explicit declaration that referenced supporting material is not available in the packet." },
  ],
  [ids[3]]: [
    { page: 92, heading: "3.1.5.2.2 Step 2. Investment Analysis", marker: "Because the Project generates no financial or economic benefits", length: 1050, role: "direct", note: "Option 1/simple cost analysis selection and Appendix 17 cost evidence reference." },
    { page: 92, heading: "3.1.5.2.3 Step 4. Common Practice Analysis", marker: "Similar activities to the proposed project occurring in Belize", length: 1500, role: "direct", note: "Common-practice comparison and geographic/regulatory similarity." },
    { page: 92, heading: "3.1.5.2.3 Step 4. Common Practice Analysis", marker: "The key distinction between the MFC REDD project", length: 1150, role: "context", note: "Funding distinction, Appendices 13/14 references, and additionality conclusion." },
  ],
  [ids[4]]: [
    { page: 14, heading: "2.1.1 Project Goals, Design and Long-Term Viability", marker: "The project is not located within a jurisdiction covered by a jurisdictional REDD+ program", length: 650, role: "direct", note: "Direct project-specific statement bearing on JNR applicability." },
    { page: 86, heading: "3.1.2 Applicability of Methodology (VCS, 3.1)", marker: "The project’s methodology follows the stepwise approach", length: 520, role: "context", note: "Methodology applicability table contains no JNR-data selection or dataset." },
    { page: 92, heading: "3.1.5.2.3 Step 4. Common Practice Analysis", marker: "Similar activities to the proposed project occurring in Belize", length: 1000, role: "context", note: "Local comparison evidence is not a jurisdictional baseline dataset." },
  ],
  [ids[5]]: [
    { page: 123, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals (VCS, 3.15, 4.1)", marker: "The estimated net GHG emission reductions are based on carbon stock changes", length: 1550, role: "direct", note: "NER equation, component definitions, and Appendix-linked quantification context." },
    { page: 124, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals (VCS, 3.15, 4.1)", marker: "To calculate contributions to the AFOLU pooled buffer account", length: 1450, role: "direct", note: "Baseline decomposition, project scenario equal to zero, uncertainty adjustment, and buffer cross-reference." },
    { page: 148, heading: "Data / parameter ∆𝐶BSL,REDD", marker: "To calculate ∆𝐶𝐵𝑆𝐿−𝑅𝐸𝐷𝐷, the following equation is applied", length: 900, role: "context", note: "Parameter-level baseline decomposition and Appendix 22 source reference." },
  ],
  [ids[6]]: [
    { page: 116, heading: "3.2.3.1 STEP 1: Identify commodity produced by baseline class of agent", marker: "market effects leakage due to decreased timber harvest was excluded", length: 1050, role: "direct", note: "Project-specific market-effects exclusion tied to de minimis HWP." },
    { page: 123, heading: "3.2.3.4 STEP 5: Estimate Leakage", marker: "Activity-shifting leakage is estimated using the following equation", length: 1450, role: "direct", note: "Planned-deforestation activity-shifting leakage equation and inputs PFc/LKCP-ME/LKMAF." },
    { page: 170, heading: "Calculation method", marker: "Activity-shifting leakage is estimated using the following equation", length: 1250, role: "context", note: "Monitoring-parameter calculation, frequency, and leakage equation." },
  ],
  [ids[7]]: [
    { page: 124, heading: "3.2.4 Estimated GHG Emission Reductions and Carbon Dioxide Removals (VCS, 3.15, 4.1)", marker: "To calculate contributions to the AFOLU pooled buffer account", length: 1450, role: "direct", note: "Buffer equation, baseline term, 12.0% risk-derived value, and explicit exclusion of leakage/uncertainty." },
    { page: 173, heading: "Purpose of data Determination of buffer contributions and calculation of VCUs", marker: "The following equation is applied", length: 1150, role: "direct", note: "Monitoring-table equation, parameter definitions, and verification frequency." },
    { page: 172, heading: "Purpose of data Calculation of VCUs", marker: "The following modified version of equation 22 from VMD0015", length: 900, role: "context", note: "Uncertainty adjustment is shown separately from the buffer calculation." },
  ],
};

function candidate(spec: Spec, pages: Page[], index: number): Evidence {
  const page = pages.find((p) => p.pageNumber === spec.page); if (!page) throw new Error(`Missing page ${spec.page}`);
  const escaped = spec.marker.trim().split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = new RegExp(escaped, "i").exec(page.text); const start = match?.index ?? -1; if (start < 0) throw new Error(`Missing marker on page ${spec.page}: ${spec.marker}`);
  return { ...spec, quote: page.text.slice(start, start + spec.length).trim(), spanId: `full-pdd:page-${spec.page}:${index + 1}`, documentId: document.documentId, documentSha256: document.contentSha256 };
}
function inventory() {
  const decisions = truthFiles.flatMap((f) => JSON.parse(execFileSync("git", ["show", `72a929a4e3551d75c8b58f75b7d9393ab1f5c89f:${f}`]).toString("utf8")).decisions as Array<{ stableRuleId: string; reviewStatus: string }>);
  if (decisions.length !== 58 || new Set(decisions.map((d) => d.stableRuleId)).size !== 58) throw new Error("Reviewed truth must contain exactly 58 unique rules");
  const reviewed = decisions.filter((d) => d.reviewStatus === "REVIEWED").length; const provisional = decisions.filter((d) => d.reviewStatus === "PROVISIONAL").length;
  if (reviewed !== 43 || provisional !== 15) throw new Error(`Unexpected inventory ${reviewed}/${provisional}`);
  return { total: 58, unique: 58, reviewed, provisional };
}
function exact(actual: string[], expected: readonly string[], label: string) { if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some((x) => !expected.includes(x))) throw new Error(`${label} does not exactly match requested eight-rule inventory`); }

export function buildArtifacts() {
  const extraction = read<{ pages: Page[] }>(extractionPath); const proposal = read<{ rows: Array<Record<string, any>> }>(proposalPath); const methodologyRules = read<Array<Record<string, any>>>("public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json"); const inv = inventory();
  const extractionSha256 = sha256(fs.readFileSync(path.join(root, extractionPath))); const proposalSha256 = sha256(fs.readFileSync(path.join(root, proposalPath))); const pddSha256 = sha256(fs.readFileSync(path.join(root, pddPath)));
  if (extractionSha256 !== "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8" || proposalSha256 !== "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b" || pddSha256 !== document.contentSha256) throw new Error("Frozen source SHA changed");
  const contexts: Record<string, unknown> = {};
  const rules = ids.map((stableRuleId) => {
    const row = proposal.rows.find((r) => r.stableRuleId === stableRuleId); if (!row) throw new Error(`Missing machine row ${stableRuleId}`);
    const methodologyRule = methodologyRules.find((r) => r.id === stableRuleId); if (!methodologyRule) throw new Error(`Missing methodology contract ${stableRuleId}`);
    const evidence = specs[stableRuleId].map((s, i) => { const e = candidate(s, extraction.pages, i); const contextId = `full-pdd-${stableRuleId.slice(-8)}-${i + 1}`; contexts[contextId] = { contextId, documentIdentity: document, pageNumber: e.page, sectionHeading: e.heading, sourceSpanId: e.spanId, exactQuote: e.quote, surroundingText: { matched: e.quote }, fullPageTextAvailableInCanonicalExtraction: true }; return { ...e, contextId }; });
    return { stableRuleId, shortRuleId: stableRuleId.split(".").at(-1), requirementText: requirements[stableRuleId], methodologyContract: { id: methodologyRule.id, logic: methodologyRule.logic, summary: methodologyRule.summary, type: methodologyRule.type, refs: methodologyRule.refs, sectionContext: methodologyRule.section_context, sourceSpanStatus: methodologyRule.source_span_status, sourceSpanText: methodologyRule.source_span_text, sha256: sha256(JSON.stringify(methodologyRule)) }, currentProvisionalJudgment: { evidenceState: row.proposedEvidenceStatus, applicability: row.proposedApplicability, outcome: row.upstreamStatus, blocker: blockers[stableRuleId] }, candidateEvidence: evidence, historicalMachineContext: { proposedEvidenceStatus: row.proposedEvidenceStatus, proposedApplicability: row.proposedApplicability, assessmentReason: row.assessmentReason, gap: row.gap, clientAction: row.clientAction }, frozenMachineRow: row, frozenMachineRowSha256: sha256(JSON.stringify(row)) };
  });
  exact(rules.map((r) => r.stableRuleId), ids, "packet");
  const machineProposalRef = { path: proposalPath, sha256: proposalSha256, proposalState: "MACHINE_PROPOSED" as const };
  const packet = { schemaVersion: "rc5-2-maya-independent-review-batch-3-packet-v1", reviewPurpose: "Frozen independent-review packet for exactly eight Maya provisional rules. Candidate evidence is unadjudicated; no reviewed truth is embedded or changed.", sourceDocument: document, canonicalRawExtraction: { path: extractionPath, sha256: extractionSha256, pageCount: extraction.pages.length, extractionEngine: "pdf-parse" }, frozenPddPdf: { path: pddPath, sha256: pddSha256 }, frozenMachineProposal: machineProposalRef, selectedRuleIds: [...ids], contexts, rules, absentReferencedEvidence: ["Appendix 17 project-cost documentation referenced by the VT0001 simple cost analysis is not included in the available source files.", "Appendix 21 harvested-wood-product calculations and Appendix 22 significance-testing/carbon-calculation workbook tabs are referenced by the PDD but are not included in the available source files.", "The PDD states the project is not inside a jurisdiction covered by a jurisdictional REDD+ program; no JNR baseline dataset or JNR evidence package is included.", "Appendices 13 and 14 agreements referenced in the common-practice/additionality conclusion are not included in the available source files.", "Appendices 19, 23, and 25A referenced for calculations, allometric validation, and field methods are not included in the available source files."], retrievalMethod: { label: "TARGETED_FULL_PDD_RETRIEVAL", searchedPageCount: extraction.pages.length, candidateEvidenceIsUnadjudicated: true, surroundingContextTablesEquationsAndCrossReferencesIncluded: true, supportingAndConflictingEvidenceIncluded: true, noReviewedTruthCreated: true }, frozenInventory: inv };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document, machineProposalRef, ruleIds: [...ids], decisionCount: ids.length });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef, decisions: rules.map((r) => ({ stableRuleId: r.stableRuleId, machineRowSha256: r.frozenMachineRowSha256, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  return {
    packet,
    schema,
    template,
    sourcePins: {
      pddSha256,
      extractionSha256,
      proposalSha256,
      reviewedTruthSha256: Object.fromEntries(
        truthFiles.map((f) => [
          f,
          sha256(execFileSync("git", ["show", `72a929a4e3551d75c8b58f75b7d9393ab1f5c89f:${f}`])),
        ]),
      ),
      methodologyRulesSha256: sha256(fs.readFileSync(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json"))),
      methodologySectionsSha256: sha256(fs.readFileSync(path.join(root, "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json"))),
    },
  };
}
export function writeArtifacts(outputDir = packetDir) { const a = buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true }); write(path.join(outputDir, "review-packet.json"), a.packet); write(path.join(outputDir, "review-response-schema.json"), a.schema); write(path.join(outputDir, "review-template.json"), a.template); const files = ["review-packet.json", "review-response-schema.json", "review-template.json"]; write(path.join(outputDir, "manifest.json"), { schemaVersion: "rc5-2-maya-independent-review-batch-3-manifest-v1", sourceCommitSha, selectedRuleIds: [...ids], sourceArtifacts: { pddPdf: { path: pddPath, sha256: a.sourcePins.pddSha256 }, canonicalExtraction: { path: extractionPath, sha256: a.sourcePins.extractionSha256 }, machineProposal: { path: proposalPath, sha256: a.sourcePins.proposalSha256 }, methodologyRules: { path: "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json", sha256: a.sourcePins.methodologyRulesSha256 }, methodologySections: { path: "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json", sha256: a.sourcePins.methodologySectionsSha256 }, reviewedTruth: a.sourcePins.reviewedTruthSha256 }, generatedFiles: Object.fromEntries(files.map((f) => [f, sha256(fs.readFileSync(path.join(outputDir, f)))])), inventory: a.packet.frozenInventory, reviewedTruthEmbeddedAsAnswer: false, generatedAt: "2026-07-19T00:00:00.000Z" }); return a; }
if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
