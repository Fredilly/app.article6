import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-targeted-full-pdd-batch-2");
const extractionPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const pddPath = path.join(root, "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf");
const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b" };
export const ids = [
  "Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0003", "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0005", "Verra.AFOLU.VM0007.v1-8.R-2-0006", "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0013", "Verra.AFOLU.VM0007.v1-8.R-2-0014", "Verra.AFOLU.VM0007.v1-8.R-4-0001",
] as const;
export const frozenPacketSha256 = "0d7cab0a1f4fe02026395e146ea8fcec6bb99a5679306b3c146f25435824c1a3";
const schemaVersion = "rc5-2-maya-targeted-full-pdd-batch-2-response-v1";
const sourceCommitSha = "3b175d8f8ea914549424849ee3e4635efbba724e";
const truthFiles = ["docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json", ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`)];
const expectedTruthSha256 = ["3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c", "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d", "2f53f56d84c47691549ee53e6f3fad57a5034f0277b6e298dd50bd071b205413", "c57cd429ded199686ba43ad65fb81d49c62503afb7d0fa54ed84ef4aaca67d4c", "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291", "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00"];
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const write = (p: string, v: unknown) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
type Page = { pageNumber: number; text: string };
type Spec = { page: number; heading: string; marker: string; length: number; role: "direct" | "context" | "conflicting_or_insufficient"; note: string };
type EvidenceReference = { quote: string; page: number; sectionHeading: string; spanId: string; documentId: string; documentSha256: string };
type CompletedResponse = { decisions: Array<{ stableRuleId: string; machineRowSha256: string; reviewStatus: string; acceptedEvidence: EvidenceReference[]; rejectedEvidence: EvidenceReference[]; [key: string]: unknown }>; [key: string]: unknown };

const requirements: Record<string, string> = {
  [ids[0]]: "Strict no-overlap rule. REDD+WRC combination is the sole exception.",
  [ids[1]]: "Double-counting prevention. Must track and report exclusions.",
  [ids[2]]: "RRD required for baseline modeling. Must be in same jurisdiction with similar characteristics.",
  [ids[3]]: "Proxy areas required for planned deforestation baseline.",
  [ids[4]]: "Stratification mandatory. Different activity types must be in separate strata.",
  [ids[5]]: "Pool inclusion/exclusion must be justified. If included in baseline, must also be in project and leakage.",
  [ids[6]]: "Fixed period for baseline modeling. Duration per VCS Standard.",
  [ids[7]]: "20-100 year range. Must be specified in PD.",
  [ids[8]]: "VT0001 mandatory for all non-tidal-wetland activities.",
};
const provisional: Record<string, { evidenceState: string; applicability: string; outcome: string; blocker: string }> = {
  [ids[0]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "The no-overlap rule requires verifying boundary exclusivity across the project area. The PDD does not explicitly address this in the provided contexts. Expert review of the full boundary section (§2.1.16) is needed." },
  [ids[1]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "The double-counting rule has multiple components. The PDD addresses inter-program double-counting but intra-project exclusion tracking needs expert review." },
  [ids[2]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "VMD0006 selection implies RRD is required, but the packet does not contain the actual RRD data. Expert review of the full baseline quantification section is needed to confirm RRD is properly documented." },
  [ids[3]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "VMD0006 selection implies proxy areas are required per VM0007. However, the packet lacks the actual proxy area data. Expert review of the baseline quantification section is needed." },
  [ids[4]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "Stratification is mandatory for REDD but the packet lacks explicit strata definitions. Expert review of the full baseline quantification section (§3.2) is needed to confirm proper stratification." },
  [ids[5]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "Pool inclusion/exclusion justification requires cross-referencing against methodology mandatory pools. Expert verification needed." },
  [ids[6]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "Accepted evidence does not directly state the fixed baseline modeling period. May exist in an unindexed PDD section. VVB should verify the PDD directly." },
  [ids[7]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "Accepted evidence does not state the crediting period. May exist in unindexed PDD section. VVB should verify." },
  [ids[8]]: { evidenceState: "UNCLEAR", applicability: "APPLICABLE", outcome: "ACTION_REQUIRED", blocker: "Expert review remains required because the full VT0001 analysis (Steps 2-4) is not yet complete." },
};
const specs: Record<string, Spec[]> = {
  [ids[0]]: [
    { page: 31, heading: "2.1.16 Project Zone Map and Project Location (VCS, 3.11, 3.18; CCB, G1.4-7, G1.13, CM1.2, B1.2)", marker: "The precise definition of the MFC project boundary requires 615 vertices", length: 950, role: "direct", note: "Boundary definition, 615 vertices, simplified Table 1, and accompanying KML; the KML/full coordinates are not in the available source files." },
    { page: 86, heading: "3.1.3 Project Boundary (VCS, 3.12)", marker: "The geographic boundaries, including the geodetic coordinators", length: 750, role: "direct", note: "States that shapefiles and KML are available to Verra/VVB or registry, but those artifacts are absent here." },
  ],
  [ids[1]]: [
    { page: 81, heading: "2.5.13 Double Counting and Participation under Other GHG Programs (VCS, 3.23; CCB G5.9)", marker: "2.5.13.1 No Double Issuance", length: 1150, role: "direct", note: "Explicit no-double-issuance and no-other-program checkboxes; does not show intra-project exclusion tracking." },
    { page: 81, heading: "2.5.12 Approvals (CCB, G5.7)", marker: "any excess carbon rights and credits remaining with the GoB", length: 650, role: "context", note: "Carbon-rights allocation context relevant to double counting, without a project-level exclusion register." },
  ],
  [ids[2]]: [
    { page: 96, heading: "3.2.1.1 Part 1. Calculating annual area of land deforested", marker: "The agent of deforestation was not specifically identified", length: 1250, role: "direct", note: "PDD identifies a class of deforestation agents and a central-Belize stratum; RRD source data itself is not supplied." },
    { page: 98, heading: "3.2.1.1.3 Rate of deforestation", marker: "For ecological and physical similarity characteristics", length: 1200, role: "direct", note: "VMD0006 similarity criterion and proxy checks; underlying RRD/LIC materials are not present." },
    { page: 278, heading: "Appendix 4: Commercially Sensitive Information", marker: "The original data provided by LIC can be found in Appendix XYZ", length: 480, role: "conflicting_or_insufficient", note: "The PDD explicitly references absent original LIC data, so it cannot by itself establish the RRD dataset." },
  ],
  [ids[3]]: [
    { page: 97, heading: "3.2.1.1.3 Rate of deforestation", marker: "To calculate the baseline rate of deforestation, 6 proxy areas were selected", length: 1350, role: "direct", note: "Six proxies, LIC parcel identifiers, and selection criteria." },
    { page: 98, heading: "3.2.1.1.3 Rate of deforestation", marker: "proxy sites deviate by no more than 20%", length: 1350, role: "direct", note: "20% similarity rule and Table 14 forest-class evidence." },
    { page: 102, heading: "3.2.1.1.3 Rate of deforestation", marker: "Table 18. Calculation of D%pn and Yrspn for the 6 proxy areas", length: 1100, role: "direct", note: "Table 18 calculations and 11.0% mean rate." },
    { page: 278, heading: "Appendix 4: Commercially Sensitive Information", marker: "The original data provided by LIC can be found in Appendix XYZ", length: 480, role: "conflicting_or_insufficient", note: "The underlying LIC records referenced by the PDD are absent from available source files." },
  ],
  [ids[4]]: [
    { page: 97, heading: "3.2.1.1 Part 1. Calculating annual area of land deforested", marker: "similar, in terms of the biophysical parameters", length: 720, role: "direct", note: "One approximately 50-km stratum is described for the deforestation-agent analysis." },
    { page: 104, heading: "3.2.1.2.1 Baseline Pre-Deforestation Carbon Stocks", marker: "it was not possible to map them as separate strata", length: 980, role: "direct", note: "Two forest types are combined into a single carbon-stock stratum; this is relevant evidence and requires independent rule assessment." },
    { page: 98, heading: "3.2.1.1.3 Rate of deforestation", marker: "Proxy areas exhibited similar pre-deforestation forest type", length: 900, role: "context", note: "Proxy forest-class stratification evidence in Table 14." },
  ],
  [ids[5]]: [
    { page: 88, heading: "3.1.3.3 Carbon Pools", marker: "All the included carbon pools are accounted for", length: 1150, role: "direct", note: "Direct cross-scenario statement, pool exclusions, and leakage treatment; Appendix 21/22 attachments are absent." },
    { page: 88, heading: "3.1.3.4 Sources of GHG Emissions", marker: "Table 12. Source of GHG emissions included in the MFC REDD project", length: 1300, role: "direct", note: "Table 12 source-by-gas inclusion/exclusion matrix." },
    { page: 104, heading: "3.2.1.2 Part 2. Baseline carbon stock change", marker: "Baseline carbon stocks in forests include the following pools", length: 1050, role: "context", note: "Baseline pool list and referenced Appendices 19, 23, and 25A." },
  ],
  [ids[6]]: [
    { page: 1, heading: "Project overview", marker: "Crediting period 1 January 2022", length: 470, role: "context", note: "Project-level crediting period stated on the cover page, but not necessarily the fixed baseline-modeling period." },
    { page: 98, heading: "3.2.1.1.3 Rate of deforestation", marker: "Deforestation in the proxy area occurred within the 10 years prior to the baseline period", length: 850, role: "direct", note: "Relative historical window is stated, while the fixed baseline modeling period itself is not expressly named." },
    { page: 101, heading: "3.2.1.1.3 Rate of deforestation", marker: "the start of the 2012-2021 historical period", length: 1150, role: "direct", note: "Actual analysis window and treatment of observations outside it." },
  ],
  [ids[7]]: [
    { page: 1, heading: "Project overview", marker: "Crediting period 1 January 2022 – 31 December 2041", length: 520, role: "direct", note: "Explicit 20-year crediting period." },
    { page: 14, heading: "2.1.1 Project Goals, Design and Long-Term Viability", marker: "An estimated 1,153,412 tonnes", length: 650, role: "context", note: "20-year lifetime and emissions accounting context." },
  ],
  [ids[8]]: [
    { page: 86, heading: "3.1.1 Title and Reference of Methodology", marker: "VT0001", length: 900, role: "direct", note: "Methodology applicability table requires VT0001 and states a stepwise baseline approach." },
    { page: 91, heading: "3.1.5.2.1 Step 1: Identification of alternative land use scenarios to the proposed AFOLU Project activity.", marker: "There are three credible alternative land use scenarios", length: 1700, role: "direct", note: "Step 1 alternatives, legality, and baseline selection." },
    { page: 92, heading: "3.1.5.2.2 Step 2. Investment Analysis", marker: "Because the Project generates no financial or economic benefits", length: 1450, role: "direct", note: "Step 2 simple cost analysis and reference to absent Appendix 17." },
    { page: 92, heading: "3.1.5.2.3 Step 4. Common Practice Analysis", marker: "Similar activities to the proposed project", length: 1350, role: "direct", note: "Step 4 comparison with private protected areas." },
    { page: 92, heading: "3.1.5.2.3 Step 4. Common Practice Analysis", marker: "The key distinction between the MFC REDD project", length: 1250, role: "direct", note: "Common-practice distinction and additionality conclusion; supporting agreements are referenced but absent." },
    { page: 90, heading: "3.1.5 Additionality (VCS, 3.14)", marker: "Are the project activities mandated by any law", length: 550, role: "conflicting_or_insufficient", note: "Regulatory-surplus checkbox is not the complete VT0001 Steps 2–4 analysis." },
  ],
};

function candidate(spec: Spec, pages: Page[], index: number) {
  const page = pages.find((p) => p.pageNumber === spec.page); if (!page) throw new Error(`Missing page ${spec.page}`);
  const escaped = spec.marker.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = new RegExp(escaped).exec(page.text); const start = match?.index ?? -1; if (start < 0) throw new Error(`Missing marker on page ${spec.page}: ${spec.marker}`);
  const quote = page.text.slice(start, start + spec.length).trim();
  return { ...spec, quote, spanId: `full-pdd:page-${spec.page}:${index + 1}`, documentId: document.documentId, documentSha256: document.contentSha256 };
}

function truthInventory() {
  const decisions = truthFiles.flatMap((file) => read<{ decisions: Array<{ reviewStatus: string; stableRuleId: string }> }>(path.join(root, file)).decisions);
  return { total: decisions.length, unique: new Set(decisions.map((d) => d.stableRuleId)).size, reviewed: decisions.filter((d) => d.reviewStatus === "REVIEWED").length, provisional: decisions.filter((d) => d.reviewStatus === "PROVISIONAL").length };
}

function evidenceKey(evidence: EvidenceReference): string {
  const candidateSectionHeading = (evidence as EvidenceReference & { heading?: string }).sectionHeading ?? (evidence as EvidenceReference & { heading?: string }).heading;
  return JSON.stringify([evidence.quote, evidence.page, candidateSectionHeading, evidence.spanId, evidence.documentId, evidence.documentSha256]);
}

function requireExactRuleSet(actual: string[], expected: string[], label: string): void {
  if (actual.length !== expected.length) throw new Error(`${label}: expected ${expected.length} decisions, got ${actual.length}`);
  if (new Set(actual).size !== actual.length) throw new Error(`${label}: duplicate stableRuleId`);
  const actualSet = new Set(actual); const expectedSet = new Set(expected);
  if (actualSet.size !== expectedSet.size || actual.some((id) => !expectedSet.has(id))) throw new Error(`${label}: rule-ID set mismatch`);
}

function assertPinnedFile(relativePath: string, expectedSha256: string, label: string): void {
  const actualSha256 = sha256(fs.readFileSync(path.join(root, relativePath)));
  if (actualSha256 !== expectedSha256) throw new Error(`frozen packet: ${label} file SHA mismatch`);
}

function assertSameJson(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`frozen packet: ${label} mismatch`);
}

/** Validate the supplied packet against the committed, byte-pinned packet and source artifacts. */
export function validateFrozenPacketIntegrity(packet: any): true {
  if (!packet || typeof packet !== "object") throw new Error("frozen packet: packet must be an object");
  const frozenPacketPath = path.join(packetDir, "review-packet.json");
  const frozenPacketBytes = fs.readFileSync(frozenPacketPath);
  if (sha256(frozenPacketBytes) !== frozenPacketSha256) throw new Error("frozen packet: committed packet SHA mismatch");
  const frozenPacket = JSON.parse(frozenPacketBytes.toString("utf8"));
  const canonicalPacketBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`);
  if (sha256(canonicalPacketBytes) !== frozenPacketSha256) throw new Error("frozen packet: supplied packet content mismatch");
  assertSameJson(packet, frozenPacket, "packet content");

  assertSameJson(packet.selectedRuleIds, ids, "selectedRuleIds");
  if (!Array.isArray(packet.rules)) throw new Error("frozen packet: rules must be an array");
  requireExactRuleSet(packet.rules.map((rule: any) => rule?.stableRuleId), [...ids], "frozen packet");
  assertSameJson(packet.sourceDocument, document, "source document identity");
  assertSameJson(packet.frozenMachineProposal, { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b", proposalState: "MACHINE_PROPOSED" }, "machine proposal reference");
  assertSameJson(packet.frozenPddPdf, { path: "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf", sha256: document.contentSha256 }, "PDD reference");
  assertSameJson(packet.canonicalRawExtraction, { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8", pageCount: 278, extractionEngine: "pdf-parse" }, "canonical extraction reference");
  assertPinnedFile(packet.frozenMachineProposal.path, packet.frozenMachineProposal.sha256, "machine proposal");
  assertPinnedFile(packet.frozenPddPdf.path, packet.frozenPddPdf.sha256, "PDD");
  assertPinnedFile(packet.canonicalRawExtraction.path, packet.canonicalRawExtraction.sha256, "canonical extraction");

  const proposal = read<{ rows: Array<Record<string, any>> }>(proposalPath);
  const proposalRows = new Map(proposal.rows.map((row) => [row.stableRuleId, row]));
  for (const rule of packet.rules) {
    const proposalRow = proposalRows.get(rule.stableRuleId);
    if (!proposalRow) throw new Error(`frozen packet: missing machine proposal row ${rule.stableRuleId}`);
    if (sha256(JSON.stringify(rule.frozenMachineRow)) !== rule.frozenMachineRowSha256) throw new Error(`frozen packet: machine row hash mismatch for ${rule.stableRuleId}`);
    assertSameJson(rule.frozenMachineRow, proposalRow, `machine proposal row ${rule.stableRuleId}`);
    const frozenRule = frozenPacket.rules.find((candidate: any) => candidate.stableRuleId === rule.stableRuleId);
    if (!frozenRule) throw new Error(`frozen packet: missing frozen rule ${rule.stableRuleId}`);
    assertSameJson(rule.candidateEvidence, frozenRule.candidateEvidence, `candidate evidence ${rule.stableRuleId}`);
  }
  return true;
}

/** Validate a completed independent response against this batch's exact frozen packet. */
export function validateCompletedResponse(response: CompletedResponse, packet: any): true {
  validateFrozenPacketIntegrity(packet);
  if (!response || !Array.isArray(response.decisions)) throw new Error("completed response: decisions must be an array");
  const expectedRuleIds = packet.selectedRuleIds;
  if (!Array.isArray(expectedRuleIds) || expectedRuleIds.length !== ids.length) throw new Error("completed response: packet rule set is not the frozen nine-rule set");
  requireExactRuleSet(response.decisions.map((decision) => decision?.stableRuleId), expectedRuleIds, "completed response");
  const packetRules = new Map(packet.rules.map((rule: any) => [rule.stableRuleId, rule]));
  if (packetRules.size !== expectedRuleIds.length || expectedRuleIds.some((id: string) => !packetRules.has(id))) throw new Error("completed response: packet rules do not exactly cover the frozen rule set");
  for (const decision of response.decisions) {
    if (decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION") throw new Error(`completed response: pending decision ${decision.stableRuleId}`);
    const rule = packetRules.get(decision.stableRuleId);
    if (!rule || decision.machineRowSha256 !== rule.frozenMachineRowSha256) throw new Error(`completed response: machine row binding failed for ${decision.stableRuleId}`);
    if (!Array.isArray(decision.acceptedEvidence) || !Array.isArray(decision.rejectedEvidence)) throw new Error(`completed response: evidence arrays missing for ${decision.stableRuleId}`);
    const candidateKeys = new Set(rule.candidateEvidence.map((evidence: EvidenceReference) => evidenceKey(evidence)));
    const acceptedKeys = new Set<string>(); const rejectedKeys = new Set<string>();
    for (const [label, evidenceList, seen] of [["acceptedEvidence", decision.acceptedEvidence, acceptedKeys], ["rejectedEvidence", decision.rejectedEvidence, rejectedKeys] ] as const) {
      for (const evidence of evidenceList) {
        const key = evidenceKey(evidence);
        if (seen.has(key)) throw new Error(`completed response: duplicate ${label} for ${decision.stableRuleId}`);
        seen.add(key);
        if (!candidateKeys.has(key)) throw new Error(`completed response: evidence provenance not in frozen candidates for ${decision.stableRuleId}`);
      }
    }
    for (const key of acceptedKeys) if (rejectedKeys.has(key)) throw new Error(`completed response: evidence appears in both accepted and rejected for ${decision.stableRuleId}`);
  }
  return true;
}

export function buildArtifacts() {
  const extraction = read<{ pages: Page[] }>(extractionPath); const proposal = read<{ rows: Array<Record<string, any>> }>(proposalPath);
  const extractionSha256 = sha256(fs.readFileSync(extractionPath)); const proposalSha256 = sha256(fs.readFileSync(proposalPath)); const pddSha256 = sha256(fs.readFileSync(pddPath));
  if (pddSha256 !== document.contentSha256) throw new Error(`PDD SHA changed: ${pddSha256}`);
  if (extractionSha256 !== "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8") throw new Error("full extraction SHA changed");
  if (proposalSha256 !== "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b") throw new Error("machine proposal SHA changed");
  // The packet is frozen independently of later reviewed-truth integration. Its
  // inventory and source pins below describe the pre-integration proposal state.
  const machineProposalRef = { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: proposalSha256, proposalState: "MACHINE_PROPOSED" as const };
  const contexts: Record<string, unknown> = {};
  const rules = ids.map((stableRuleId) => {
    const row = proposal.rows.find((r) => r.stableRuleId === stableRuleId); if (!row) throw new Error(`Missing machine row ${stableRuleId}`);
    const evidence = specs[stableRuleId].map((spec, index) => { const e = candidate(spec, extraction.pages, index); const contextId = `full-pdd-${stableRuleId.split(".").at(-1)}-${e.spanId.replaceAll(":", "-")}`; contexts[contextId] = { contextId, documentIdentity: document, pageNumber: e.page, sectionHeading: e.heading, sourceSpanId: e.spanId, exactQuote: e.quote, matchFoundInCanonicalExtraction: true, surroundingText: { matched: e.quote } }; return { ...e, index, contextId }; });
    return { stableRuleId, shortRuleId: stableRuleId.split(".").at(-1), requirementText: requirements[stableRuleId], currentProvisionalJudgment: provisional[stableRuleId], candidateEvidence: evidence, historicalMachineContext: { label: "NON_FINAL_MACHINE_CONTEXT", proposedEvidenceStatus: row.proposedEvidenceStatus, proposedApplicability: row.proposedApplicability, assessmentReason: row.assessmentReason, gap: row.gap, clientAction: row.clientAction }, frozenMachineRow: row, frozenMachineRowSha256: sha256(JSON.stringify(row)) };
  });
  const packet = { schemaVersion: "rc5-2-maya-targeted-full-pdd-batch-2-packet-v1", reviewPurpose: "Frozen independent-review packet for targeted full-PDD retrieval. No rule is adjudicated or finalized; candidate evidence and machine context are non-final.", sourceDocument: document, canonicalRawExtraction: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: extractionSha256, pageCount: extraction.pages.length, extractionEngine: "pdf-parse" }, frozenPddPdf: { path: "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf", sha256: pddSha256 }, frozenMachineProposal: machineProposalRef, selectedRuleIds: [...ids], contexts, rules, absentReferencedEvidence: ["The full 615-vertex KML and shapefiles referenced on pages 31 and 86 are absent from the available source files.", "The original LIC parcel registry data referenced as Appendix 24/Appendix XYZ on pages 97 and 278 is absent.", "Appendix 10 benchmark-map supporting material is absent.", "Appendix 17 project-cost documentation referenced by Step 2 on page 92 is absent.", "Appendices 11/11A/11D, 13, and 14 referenced by the baseline/additionality narrative are absent.", "Appendices 19, 21, 22, 23, and 25A referenced for pool significance, calculations, validation, and field methods are absent."], retrievalMethod: { label: "TARGETED_FULL_PDD_RETRIEVAL", searchedPageCount: extraction.pages.length, candidateEvidenceIsUnadjudicated: true, supportingAndConflictingEvidenceIncluded: true, noReviewedTruthCreated: true }, frozenInventory: { reviewed: 41, provisional: 17 } };
  const schema = buildRc5AdjudicationResponseSchema({ schemaVersion, document, machineProposalRef, ruleIds: [...ids], decisionCount: ids.length });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef, decisions: rules.map((r) => ({ stableRuleId: r.stableRuleId, machineRowSha256: r.frozenMachineRowSha256, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], contradictionState: null, draftFindingCandidate: null, assessmentReason: null, gap: null, clientAction: null, correctionReason: null, genericFailureCategory: null, reviewerConfidence: null, provisionalReason: null })) };
  return { packet, schema, template, sourcePins: { pddSha256, extractionSha256, proposalSha256, reviewedTruthSha256: Object.fromEntries(truthFiles.map((f, i) => [f, expectedTruthSha256[i]])) } };
}

export function writeArtifacts(outputDir = packetDir) {
  const artifacts = buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true });
  write(path.join(outputDir, "review-packet.json"), artifacts.packet); write(path.join(outputDir, "review-response-schema.json"), artifacts.schema); write(path.join(outputDir, "review-template.json"), artifacts.template);
  const files = ["review-packet.json", "review-response-schema.json", "review-template.json"];
  write(path.join(outputDir, "manifest.json"), { schemaVersion: "rc5-2-maya-targeted-full-pdd-batch-2-manifest-v1", sourceCommitSha, selectedRuleIds: [...ids], sourceArtifacts: { pddPdf: { path: "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf", sha256: artifacts.sourcePins.pddSha256 }, canonicalExtraction: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", sha256: artifacts.sourcePins.extractionSha256 }, machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: artifacts.sourcePins.proposalSha256 }, reviewedTruth: artifacts.sourcePins.reviewedTruthSha256 }, generatedFiles: Object.fromEntries(files.map((f) => [f, sha256(fs.readFileSync(path.join(outputDir, f)))])), inventory: { reviewed: 41, provisional: 17 }, reviewedTruthEmbeddedAsAnswer: false, generatedAt: "2026-07-19T00:00:00.000Z" });
  return artifacts;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
