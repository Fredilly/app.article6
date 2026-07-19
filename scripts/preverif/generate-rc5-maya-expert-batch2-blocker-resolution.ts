import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution");
const sourcePath = path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf");
const officialExtractionPath = path.join(packetDir, "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json");
const pddPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json");
const pddPdfPath = path.join(root, "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf");
const responsePath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/independent-expert-response.json");
const integrationManifestPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/integration-manifest.json");
const machineProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const reviewedTruthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-1-0012",
  "Verra.AFOLU.VM0007.v1-8.R-1-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
] as const;
const sha256 = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const writeJson = (filePath: string, value: unknown) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const officialSourceSha256 = "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6";
const pddSha256 = "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b";
const pddExtractionSha256 = "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8";
const expertResponseSha256 = "a15898f0ba5d5e1122363416731f84c7a5270a6a0db46dce598f1a5d34092384";
const integrationManifestSha256 = "9162700fdffb9a6f4cdee8c167f9b4adcf7ab11e3860d204fb5b2fc7a0dcf7f2";
const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
const reviewedTruthSha256 = [
  "3a5ea6b5c1cc9576543aca28fe24959e244a6c4e69c30063a9f39c801d19b45c",
  "a26b0bae33cf0f436d80fe6c00622fdf0ddc65359cacc845dc764e994b0c263d",
  "cd9f6d4771d99877fac10347b5fa91bd9f650c0b5a336a1c8d23966540c9ddd4",
  "c57cd429ded199686ba43ad65fb81d49c62503afb7d0fa54ed84ef4aaca67d4c",
  "d118035e690e25e89af22d9fcf3b7af301d44627580b5b6450e6f641431f5291",
  "df6959a1d673859d00fb02adee99854e45970ecdeb123e6fe44bb96871cd6d00",
];
const reviewedRowsSha256 = "922d7cc1eb95d9b9e35f58073120d0ffe8db7bb5b2c4dddf352522bb43a7dba1";
const officialPdfPageCount = 54;
const officialExtractionSha256 = "80164150eeb7fa8eb916c73bbcdab0cc0b79d49d544dc9c28cef7c61a8166561";
const integrationManifest = readJson<any>(integrationManifestPath);
const frozenMachineRowHashes: Record<string, string> = Object.fromEntries(selectedRuleIds.map((ruleId) => [ruleId, integrationManifest.rules[ruleId].frozenMachineRowHash]));

type Page = { pageNumber: number; text: string };
const pdd = readJson<{ pages: Page[] }>(pddPath);
type OfficialPage = { pageNumber: number; text: string };
type OfficialExtraction = { schemaVersion: string; sourcePdfSha256: string; pageCount: number; pages: OfficialPage[] };
const officialExtraction = readJson<OfficialExtraction>(officialExtractionPath);
const page = (n: number) => pdd.pages.find((candidate) => candidate.pageNumber === n)?.text ?? "";
const officialPage = (n: number) => officialExtraction.pages.find((candidate) => candidate.pageNumber === n)?.text ?? "";
const projectEvidence = (ruleId: string, pageNumber: number, section: string, spanId: string, quote: string, availability: string = "PRESENT_IN_FROZEN_PDD") => ({
  ruleId,
  quote,
  page: pageNumber,
  section,
  spanId,
  documentId: "quick-check-review-question",
  documentName: "12-maya-forest-corridor-redd-belize.pdf",
  documentSha256: pddSha256,
  sourceType: "PDD",
  availability,
});
const officialEvidence = (ruleId: string, pageNumber: number, section: string, spanId: string, quote: string) => ({
  ruleId,
  exactQuote: quote,
  page: pageNumber,
  section,
  spanId,
  documentId: "verra-vm0007-v1-8-official-publication",
  documentSha256: officialSourceSha256,
  sourceType: "OFFICIAL_VERRA_PUBLICATION",
});

const rules = {
  [selectedRuleIds[0]]: {
    blockerResolutionTarget: "Establish whether the project is REDD-only and whether R-1-0012 is a WRC tidal-wetland condition.",
    methodologyEvidence: [officialEvidence(selectedRuleIds[0], 17, "4.3.3 CIW Project Activities", "verra-vm0007-v1-8:p17:condition-17", "17) Project activities conserving tidal wetlands include:\na) Protecting at-risk wetlands (e.g., establishing conservation easements,\nestablishing community supported management agreements,\nestablishing protective government regulations, and preventing disruption of water and/or\nsediment supply to wetland areas)\nb) Improving water management on drained wetlands\nc) Maintaining or improving water quality for seagrass meadows\nd) Recharging sediment to avoid drowning of coastal wetlands\ne) Creating accommodation space for wetlands migrating with sea-level rise")],
    projectEvidence: [
      projectEvidence(selectedRuleIds[0], 15, "2.1.3 Project Type", "quick-check-review-question:element:paragraph:2.1.3", "AFOLU project category 13 Reduced Emissions from Deforestation and Degradation (REDD)\nProject activity type Avoiding planned deforestation"),
      projectEvidence(selectedRuleIds[0], 84, "3.1.2 Applicability of Methodology", "quick-check-review-question:element:paragraph:3.1.2:wetlands", "The project area contains no peatlands or tidal wetlands."),
    ],
    missingEvidence: [
      { item: "WRC activity declaration or an explicit REDD-only statement covering every project activity", status: "REFERENCED_OR_REQUESTED_BUT_NOT_PRESENT_IN_FROZEN_PDD", source: "Frozen PDD has REDD/APD selections and no-wetland justification, but no standalone REDD-only/WRC declaration." },
    ],
  },
  [selectedRuleIds[1]]: {
    blockerResolutionTarget: "Confirm the wetland-degradation activity branch and preserve explicit REDD/APDef, no-wetland, and module-selection evidence.",
    methodologyEvidence: [officialEvidence(selectedRuleIds[1], 17, "4.3.3 CIW Project Activities", "verra-vm0007-v1-8:p17:condition-18", "a) Cause an alteration in the hydrology of the project area (involving drainage,\ninterrupted sediment supply or both) and/or a loss of soil organic carbon\nb) Have no documented and uncontested legal right to degrade the wetland, and\nc) Are either residents in the reference region for wetland degradation (see Section 5.1.4 below) or immigrants.")],
    projectEvidence: [
      projectEvidence(selectedRuleIds[1], 83, "3.1.1 Title and Reference of Methodology", "quick-check-review-question:element:paragraph:3.1.1", "Methodology VM0007 VM0007 REDD+ Methodology Framework (REDD+MF)"),
      projectEvidence(selectedRuleIds[1], 83, "3.1.1 Title and Reference of Methodology", "quick-check-review-question:element:paragraph:3.1.1:vmd0006", "Module VMD0006 VMD0006 Estimation of baseline"),
      projectEvidence(selectedRuleIds[1], 84, "3.1.2 Applicability of Methodology", "quick-check-review-question:element:paragraph:3.1.2:wetlands", "The project area contains no peatlands or tidal wetlands."),
      projectEvidence(selectedRuleIds[1], 84, "3.1.2 Applicability of Methodology", "quick-check-review-question:element:paragraph:3.1.2:apdef", "baseline deforestation falls within the planned deforestation category."),
      projectEvidence(selectedRuleIds[1], 86, "3.1.2 Applicability of Methodology", "quick-check-review-question:element:paragraph:3.1.2:redd", "Project is a REDD based project thus the module is mandatory."),
    ],
    missingEvidence: [
      { item: "Explicit project-level declaration that no WRC, AUWD, or APWD activity is included", status: "REFERENCED_OR_REQUESTED_BUT_NOT_PRESENT_IN_FROZEN_PDD", source: "The PDD identifies the project as REDD and planned deforestation and states no peatlands/tidal wetlands; it does not use a single explicit no-WRC declaration." },
    ],
  },
  [selectedRuleIds[2]]: {
    blockerResolutionTarget: "Reconcile pool selection, significance testing, Table 4, and baseline/project/leakage symmetry without inventing missing appendices.",
    methodologyEvidence: [officialEvidence(selectedRuleIds[2], 22, "5.3.2 REDD", "verra-vm0007-v1-8:p22:section-5.3.2", "The carbon pools (and corresponding methodology modules) included in or excluded from the boundary of REDD project activities are shown in Table 4. Harvested wood products and dead wood must be included when they increase more or decrease less in the baseline than in the project scenario. In all other cases, only aboveground biomass is mandatory. If a carbon pool is included in the baseline accounting, it must also be included in project scenario and leakage accounting. Where the carbon pool in harvested wood products and dead wood increases more or decreases less in the baseline case than in the project case, the tool T-SIG or Appendix 1 must be used to determine whether significant. Insignificant pools can always be ignored.")],
    projectEvidence: [
      projectEvidence(selectedRuleIds[2], 83, "3.1.1 Title and Reference of Methodology", "quick-check-review-question:element:paragraph:3.1.1:pools", "Module VMD0002 Estimation of carbon stocks in the"),
      projectEvidence(selectedRuleIds[2], 87, "3.1.3.3 Carbon pools", "quick-check-review-question:element:paragraph:3.1.3.3", "The following carbon pools are accounted for: aboveground tree biomass (for trees with a diameter at breast height of greater than or equal to 5 cm), belowground tree biomass, aboveground biomass for palms, standing and lying dead wood, and soil organic carbon."),
      projectEvidence(selectedRuleIds[2], 88, "3.1.3.3 Carbon pools", "quick-check-review-question:element:paragraph:3.1.3.3", "belowground palm biomass are excluded because they were deemed de minimis following the guidance provided in VM0007’s Appendix 1: Testing Significance of GHG Emissions."),
      projectEvidence(selectedRuleIds[2], 88, "3.1.3.3 Carbon pools", "quick-check-review-question:element:paragraph:3.1.3.3:appendix22", "Tab \"Test of sig - 6 year bsl valid\" of Appendix 22 provides the details of these significance testing calculations."),
      projectEvidence(selectedRuleIds[2], 88, "3.1.3.3 Carbon pools", "quick-check-review-question:element:paragraph:3.1.3.3:deadwood", "While dead wood was also identified as de minimis, given the potential future increase in the size of this pool in the event of a hurricane or tropical storm, it was deemed important to include."),
      projectEvidence(selectedRuleIds[2], 88, "3.1.3.3 Carbon pools", "quick-check-review-question:element:paragraph:3.1.3.3:symmetry", "All the included carbon pools are accounted for in the baseline and project scenarios as well as in the accounting of activity shifting leakage."),
    ],
    missingEvidence: [
      { item: "Appendix 22, including the ‘Test of sig - 6 year bsl valid’ tab and numeric HWP baseline-versus-project significance result", status: "REFERENCED_BUT_ABSENT", source: "Referenced on frozen PDD page 88; not present in the frozen 278-page PDD extraction or repository attachments." },
      { item: "Appendix 21 HWP calculation attachment", status: "REFERENCED_BUT_ABSENT", source: "Referenced on frozen PDD page 88; not present in the frozen PDD extraction or repository attachments." },
      { item: "Project carbon-pool selection matrix/Table 4", status: "REFERENCED_BUT_ABSENT", source: "VM0007 official Section 5.3.2 requires Table 4; the PDD’s own Table 4 is a Belize-law table on page 46, not a carbon-pool matrix." },
    ],
  },
} as const;

export function assertSourceAndTruthPins() {
  if (sha256(fs.readFileSync(sourcePath)) !== officialSourceSha256) throw new Error("Official source SHA changed");
  if (officialExtraction.sourcePdfSha256 !== officialSourceSha256 || officialExtraction.pageCount !== officialPdfPageCount || officialExtraction.pages.length !== officialPdfPageCount) throw new Error("Official extraction identity changed");
  if (sha256(fs.readFileSync(officialExtractionPath)) !== officialExtractionSha256) throw new Error("Official extraction SHA changed");
  if (sha256(fs.readFileSync(pddPdfPath)) !== pddSha256) throw new Error("Frozen Maya PDD SHA changed");
  if (sha256(fs.readFileSync(pddPath)) !== pddExtractionSha256) throw new Error("Frozen Maya extraction SHA changed");
  if (sha256(fs.readFileSync(responsePath)) !== expertResponseSha256) throw new Error("Merged expert response SHA changed");
  if (sha256(fs.readFileSync(integrationManifestPath)) !== integrationManifestSha256) throw new Error("Integration manifest SHA changed");
  if (sha256(fs.readFileSync(machineProposalPath)) !== machineProposalSha256) throw new Error("Machine proposal SHA changed");
  reviewedTruthFiles.forEach((file, i) => { if (sha256(fs.readFileSync(path.join(root, file))) !== reviewedTruthSha256[i]) throw new Error(`Reviewed truth changed: ${file}`); });
  const rows = reviewedTruthFiles.flatMap((file) => readJson<any>(path.join(root, file)).decisions.filter((row: any) => row.reviewStatus === "REVIEWED")).sort((a: any, b: any) => a.stableRuleId.localeCompare(b.stableRuleId));
  if (rows.length !== 39 || sha256(JSON.stringify(rows)) !== reviewedRowsSha256) throw new Error("39 reviewed rows or digest changed");
  const provisional = readJson<any>(path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json")).inventory;
  if (provisional.reviewedRuleCount !== 39 || provisional.provisionalRuleCount !== 19) throw new Error("39/19 inventory changed");
}

export function validatePacket(candidatePacket: any, overrides: { officialExtraction?: OfficialExtraction; officialExtractionBytes?: Buffer | string; pdd?: { pages: Page[] }; pddExtractionBytes?: Buffer | string } = {}) {
  const candidateOfficialExtraction = overrides.officialExtraction ?? officialExtraction;
  const candidatePdd = overrides.pdd ?? pdd;
  const candidateOfficialBytes = overrides.officialExtractionBytes ?? fs.readFileSync(officialExtractionPath);
  const candidatePddBytes = overrides.pddExtractionBytes ?? fs.readFileSync(pddPath);
  if (sha256(candidateOfficialBytes) !== officialExtractionSha256) throw new Error("Official extraction bytes changed");
  if (sha256(candidatePddBytes) !== pddExtractionSha256) throw new Error("Maya extraction bytes changed");
  if (candidateOfficialExtraction.sourcePdfSha256 !== officialSourceSha256 || candidateOfficialExtraction.pageCount !== officialPdfPageCount || candidateOfficialExtraction.pages.length !== officialPdfPageCount) throw new Error("Official extraction content changed");
  if (JSON.stringify(candidatePacket.selectedRuleIds) !== JSON.stringify([...selectedRuleIds])) throw new Error("Selected rule coverage changed");
  if (candidatePacket.rules.length !== selectedRuleIds.length) throw new Error("Packet rule count changed");
  if (candidatePacket.officialMethodologySource.sha256 !== officialSourceSha256 || candidatePacket.officialMethodologySource.sourceType !== "OFFICIAL_VERRA_PUBLICATION") throw new Error("Official source identity is not pinned");
  if (candidatePacket.officialMethodologySource.extractionSha256 !== officialExtractionSha256) throw new Error("Official extraction identity is not pinned");
  for (const rule of candidatePacket.rules) {
    const expected = (rules as any)[rule.ruleId];
    if (!expected) throw new Error(`Unexpected rule: ${rule.ruleId}`);
    if (rule.methodologyEvidence.length !== expected.methodologyEvidence.length || rule.projectEvidence.length !== expected.projectEvidence.length) throw new Error(`Evidence count changed: ${rule.ruleId}`);
    for (const evidence of rule.methodologyEvidence) {
      if (evidence.ruleId !== rule.ruleId || evidence.sourceType !== "OFFICIAL_VERRA_PUBLICATION" || evidence.documentId !== "verra-vm0007-v1-8-official-publication" || evidence.documentSha256 !== officialSourceSha256) throw new Error(`Official evidence identity failed: ${rule.ruleId}`);
      const expectedEvidence = expected.methodologyEvidence.find((item: any) => JSON.stringify(item) === JSON.stringify(evidence));
      if (!expectedEvidence) throw new Error(`Methodology evidence is not frozen for rule: ${rule.ruleId}`);
      const claimedOfficialPage = candidateOfficialExtraction.pages.find((item) => item.pageNumber === evidence.page)?.text ?? "";
      if (!normalize(claimedOfficialPage).includes(normalize(evidence.exactQuote))) throw new Error(`Official quote is not on claimed page: ${rule.ruleId}:${evidence.page}`);
    }
    for (const evidence of rule.projectEvidence) {
      if (evidence.ruleId !== rule.ruleId || evidence.documentId !== "quick-check-review-question" || evidence.documentSha256 !== pddSha256) throw new Error(`Project evidence identity failed: ${rule.ruleId}`);
      const expectedEvidence = expected.projectEvidence.find((item: any) => JSON.stringify(item) === JSON.stringify(evidence));
      if (!expectedEvidence) throw new Error(`Project evidence is not frozen for rule: ${rule.ruleId}`);
      const claimedPddPage = candidatePdd.pages.find((item) => item.pageNumber === evidence.page)?.text ?? "";
      if (normalize(claimedPddPage).includes(normalize(evidence.quote)) === false) throw new Error(`Project quote is not in frozen source: ${evidence.spanId} page=${evidence.page}`);
    }
  }
}

export function assertEvidence() {
  validatePacket(buildPacket());
}

export function buildPacket() {
  assertSourceAndTruthPins();
  const expert = readJson<any>(responsePath);
  const packet = {
    schemaVersion: "rc5-2-maya-expert-batch-2-blocker-resolution-packet-v2",
    purpose: "Complete source-and-evidence blocker-resolution packet only. No rule is adjudicated or finalized.",
    selectedRuleIds: [...selectedRuleIds],
    baseline: { mergedPr1088Commit: "3eba6f821fcd4ab864ee72aa5b83253f8887dad8", mergedPr: 1088, branchBase: "main" },
    officialMethodologySource: { sourceType: "OFFICIAL_VERRA_PUBLICATION", documentId: "verra-vm0007-v1-8-official-publication", path: "official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf", sha256: officialSourceSha256, extractionPath: "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json", extractionSha256: officialExtractionSha256, extractionMethod: "NORMAL_PDF_TEXT_PAGE_BY_PAGE", title: "VM0007 REDD+ Methodology Framework (REDD+MF)", version: "v1.8", publisher: "Verra", provenanceUrl: "https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-8/", publicationStatus: "Active since 04 June 2024", verifiedAgainstDerivedSourceSha256: "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6" },
    frozenProjectSource: { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", extractionPath: "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json", extractionSha256: pddExtractionSha256, documentSha256: pddSha256, pageCount: pdd.pages.length, sourceType: "PDD" },
    currentExpertConclusions: selectedRuleIds.map((ruleId) => ({ ruleId, ...expert.responses[ruleId] })),
    rules: selectedRuleIds.map((ruleId) => ({ ruleId, ...rules[ruleId] })),
    absentSourceDeclarations: ["Appendix 21 attachment is referenced by the PDD but absent.", "Appendix 22 attachment and its ‘Test of sig - 6 year bsl valid’ tab are referenced by the PDD but absent.", "The project carbon-pool Table 4 is absent; the PDD’s Table 4 is a Belize-law table, not the methodology pool matrix."],
    truthProtection: { machineProposal: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: machineProposalSha256 }, expertResponse: { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/independent-expert-response.json", sha256: expertResponseSha256 }, integrationManifest: { path: "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-response-integration/integration-manifest.json", sha256: integrationManifestSha256 }, reviewedTruthFiles: reviewedTruthFiles.map((file, i) => ({ path: file, sha256: reviewedTruthSha256[i] })), semanticReviewedRowsSha256: reviewedRowsSha256, inventory: { reviewed: 39, provisional: 19 }, noNewReviewedTruth: true, noConclusionsChanged: true },
  };
  validatePacket(packet);
  return packet;
}

export async function regenerateOfficialExtraction() {
  const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
  const pdfBytes = fs.readFileSync(sourcePath);
  const parser = new PDFParse({ data: pdfBytes });
  const text = await parser.getText();
  const artifact: OfficialExtraction = { schemaVersion: "rc5-official-pdf-page-extraction-v1", sourcePdfSha256: sha256(pdfBytes), pageCount: text.total, pages: text.pages.map((item: { num: number; text: string }) => ({ pageNumber: item.num, text: item.text })) };
  await parser.destroy();
  writeJson(officialExtractionPath, artifact);
  return sha256(fs.readFileSync(officialExtractionPath));
}

export async function writeArtifacts() {
  await regenerateOfficialExtraction();
  const packet = buildPacket();
  writeJson(path.join(packetDir, "blocker-resolution-packet.json"), packet);
  const canonicalSchema = buildRc5AdjudicationResponseSchema({ schemaVersion: "rc5-canonical-final-decision-v1", document: { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: pddSha256 }, machineProposalRef: { path: "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json", sha256: machineProposalSha256, proposalState: "MACHINE_PROPOSED" }, ruleIds: [...selectedRuleIds], decisionCount: selectedRuleIds.length });
  const canonicalDecisionSchemas = Object.fromEntries(selectedRuleIds.map((ruleId) => {
    const decisionSchema = JSON.parse(JSON.stringify(canonicalSchema.$defs.decision));
    decisionSchema.properties.stableRuleId = { const: ruleId };
    decisionSchema.properties.machineRowSha256 = { const: frozenMachineRowHashes[ruleId] };
    return [`canonicalDecision_${ruleId.replace(/[^A-Za-z0-9]/g, "_")}`, decisionSchema];
  }));
  const responseSchema = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", additionalProperties: false, required: ["schemaVersion", "responses"], properties: { schemaVersion: { const: "rc5-2-maya-expert-batch-2-independent-review-response-v2" }, responses: { type: "object", additionalProperties: false, required: [...selectedRuleIds], properties: Object.fromEntries(selectedRuleIds.map((ruleId) => { const decisionRef = `#/$defs/canonicalDecision_${ruleId.replace(/[^A-Za-z0-9]/g, "_")}`; return [ruleId, { type: "object", additionalProperties: false, required: ["reviewStatus", "evidenceAssessment", "finalRuleDecision", "remainingBlockers", "notes"], properties: { reviewStatus: { enum: ["RESOLVED", "UNRESOLVED"] }, evidenceAssessment: { type: "string", minLength: 1 }, finalRuleDecision: { oneOf: [{ type: "null" }, { $ref: decisionRef }] }, remainingBlockers: { type: "array", items: { type: "string", minLength: 1 } }, notes: { type: "string", minLength: 1 } }, allOf: [{ if: { properties: { reviewStatus: { const: "RESOLVED" } } }, then: { properties: { finalRuleDecision: { $ref: decisionRef }, remainingBlockers: { maxItems: 0 } } } }, { if: { properties: { reviewStatus: { const: "UNRESOLVED" } } }, then: { properties: { finalRuleDecision: { const: null }, remainingBlockers: { minItems: 1 } } } }] }]; })) } }, $defs: { ...canonicalDecisionSchemas, evidenceReference: canonicalSchema.$defs.evidenceReference } };
  writeJson(path.join(packetDir, "independent-review-response-schema.json"), responseSchema);
  writeJson(path.join(packetDir, "independent-review-response-template.json"), { schemaVersion: "rc5-2-maya-expert-batch-2-independent-review-response-v2", responses: Object.fromEntries(selectedRuleIds.map((ruleId) => [ruleId, { reviewStatus: null, evidenceAssessment: "", finalRuleDecision: null, remainingBlockers: [], notes: "" }])) });
  const files = ["blocker-resolution-packet.json", "independent-review-response-schema.json", "independent-review-response-template.json", "review-instructions.md", "official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json"];
  const manifest = { schemaVersion: "rc5-2-maya-expert-batch-2-blocker-resolution-manifest-v2", selectedRuleIds: [...selectedRuleIds], officialSourceSha256, officialExtractionSha256, mayaPdfSha256: pddSha256, mayaExtractionSha256: pddExtractionSha256, packetSha256: sha256(fs.readFileSync(path.join(packetDir, files[0]))), files: Object.fromEntries(files.map((file) => [file, sha256(fs.readFileSync(path.join(packetDir, file)))])), mergedPr1088Commit: "3eba6f821fcd4ab864ee72aa5b83253f8887dad8", reviewedTruthSha256, semanticReviewedRowsSha256: reviewedRowsSha256, inventory: { reviewed: 39, provisional: 19 }, reviewedTruthFilesCreated: false };
  writeJson(path.join(packetDir, "manifest.json"), manifest);
  return manifest;
}

if (require.main === module) writeArtifacts().catch((error) => { console.error(error); process.exitCode = 1; });
