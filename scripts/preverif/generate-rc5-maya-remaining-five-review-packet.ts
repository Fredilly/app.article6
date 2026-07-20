import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  responseValidatorCliPath,
  responseValidatorImplementationPath,
} from "./rc5-maya-remaining-five-response-validator";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet");
export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-3-0001",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
  "Verra.AFOLU.VM0007.v1-8.R-2-0002",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
] as const;
export const excludedRuleIds = [] as const;
export const baselineCommit = "2d4d6a54831aeff8a1295aff4d0be240218d9579";
export const machineSha = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
export const rulesPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json";
export const sectionsPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json";
export const vmPdfPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pdf";
export const vmPagesPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-expert-batch-2-blocker-resolution/official-source/VM0007-REDD-Methodology-Framework-v1.8.pages.json";
export const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
export const extractionPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize/raw-document-extraction.json";
export const proposalPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
export const truthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((n) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${n}-adjudication/reviewed-truth.json`),
];
export const contractSnapshotPath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-remaining-five-review-packet/official-source/selected-rule-contracts-baseline.json";
const expectedSourceSha: Record<string, string> = {
  [rulesPath]: "9fceaa1dc458c847c1236fad73215f56b924ebbec794850b60c0510ace7d0e49",
  [sectionsPath]: "4506bb488417a940fc4e84228bff7abcc7e7921fcb9a824fa140bf6e2687b5e3",
  [vmPdfPath]: "68bb94746c4c4adb40acbe314a3f927e2a3a57af9bf4916afdbcf532ea0b50e6",
  [vmPagesPath]: "80164150eeb7fa8eb916c73bbcdab0cc0b79d49d544dc9c28cef7c61a8166561",
  [pddPath]: "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b",
  [extractionPath]: "b9da3f4f836a8a4a0ff64cae96bbd69f186eb087a639f60d95f8f9a0ff1a8ae8",
  [proposalPath]: machineSha,
};
const methodologyPages = Array.from({ length: 15 }, (_, i) => i + 15);
const pddPages: Record<string, number[]> = {
  "R-3-0001": [86, 91, 92],
  "R-4-0001": [86, 91, 92],
  "R-2-0002": [78, 79, 80, 81, 82],
  "R-2-0004": [97, 98, 99, 100, 101, 102, 103, 104, 278],
  "R-2-0007": [87, 88, 89, 110, 111, 112, 113, 114, 115, 116],
  "R-2-0008": [87, 88, 89, 110, 111, 112, 113, 114, 115, 116],
  "R-3-0008": [91, 92, 93, 94, 95, 96],
};
const questions: Record<string, string> = {
  "R-3-0001": "Does the Maya PDD independently establish the VM0007 additionality requirement, including the Appendix 17 cost evidence blocker, and what evidence state, applicability, outcome, accepted/rejected evidence, gaps, client actions, and confidence are justified? Treat Appendix 17 as unresolved unless the frozen evidence proves otherwise.",
  "R-4-0001": "Does the Maya PDD independently satisfy the VM0007/VT0001 additionality requirement, including whether the Appendix 17 blocker leaves the required pathway unresolved, and what evidence state, applicability, outcome, accepted/rejected evidence, gaps, client actions, and confidence are justified? Treat Appendix 17 as an unresolved question, not an assumption.",
  "R-2-0002": "Does the complete VM0007 boundary requirement establish that the Maya project satisfies the no-overlap condition, including exclusion of land registered under another GHG program and any applicable REDD+WRC exception?",
  "R-2-0004": "Does the Maya PDD provide the boundary type and complete reference-region/proxy evidence required for its planned-deforestation baseline, or are the cited underlying data and delineation rationale necessary to decide the rule?",
  "R-2-0007": "Does the Maya PDD justify carbon-pool selection under VM0007 Sections 5.3.1–5.3.2, including significance testing and consistent baseline/project/leakage accounting?",
  "R-2-0008": "Does the Maya PDD apply the mandatory REDD pool rule correctly, including the conditional HWP/dead-wood significance test and the cross-scenario inclusion requirement?",
  "R-3-0008": "If the project uses jurisdictional baseline data, does the evidence establish that the data meet VCS JNR Requirements and are conservative, and if no such data are used is this rule not applicable?",
};
const sha256 = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const authorizedFinalRowSha256: Record<string, string> = {
  "Verra.AFOLU.VM0007.v1-8.R-3-0001": "219b2a8c4c5d72db232ee318e3e0afe36c67d4c687fa9bab50f03c1a0769f900",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001": "0c26b8eaeeab79f18ce83aa317a77b48877278c4360da8f76a97928db87b2da2",
  "Verra.AFOLU.VM0007.v1-8.R-2-0002": "340a63e03b673e9d0a06e0b54c08ed454cf9e818f111f3e7d904abc7514488fa",
  "Verra.AFOLU.VM0007.v1-8.R-2-0004": "07d3d14d8640b64d5266a755335ce4e8f950e722498fb6a643b0405eb941c283",
  "Verra.AFOLU.VM0007.v1-8.R-2-0007": "cc1256f00cfdb3c5d4a005ce1110da09724088d2667aa32b49ecdec90e928d9b",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008": "d6d84d9686bde03e0d19fad995618d465764eb06a71d8ad7363e4a2195be941d",
};
const absolute = (p: string) => path.join(root, p);
const bytes = (p: string) => fs.readFileSync(absolute(p));
const read = <T>(p: string): T => JSON.parse(bytes(p).toString("utf8")) as T;
const frozenBytes = (p: string) => execFileSync("git", ["show", `${baselineCommit}:${p}`], { cwd: root });
const short = (id: string) => id.split(".").at(-1)!;
const writeJson = (p: string, value: unknown) => fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);

type Row = Record<string, any> & { stableRuleId: string; reviewStatus: string };
type Page = { pageNumber: number; text: string };
type EvidenceObject = {
  sourcePath: string;
  sourceSha256: string;
  sourcePdfPath: string;
  sourcePdfSha256: string;
  page: number;
  completeExactQuote: string;
};

function inventory(rows: Row[], expectedReviewed: number, expectedProvisional: number, expectedProvisionalIds: readonly string[]) {
  const unique = new Set(rows.map((r) => r.stableRuleId));
  const reviewed = rows.filter((r) => r.reviewStatus === "REVIEWED").length;
  const provisional = rows.filter((r) => r.reviewStatus === "PROVISIONAL").length;
  if (rows.length !== 58 || unique.size !== 58 || reviewed !== expectedReviewed || provisional !== expectedProvisional) throw new Error(`Current inventory mismatch: ${reviewed}/${provisional}/${unique.size}`);
  const provisionalIds = rows.filter((r) => r.reviewStatus === "PROVISIONAL").map((r) => r.stableRuleId).sort();
  if (JSON.stringify(provisionalIds) !== JSON.stringify([...expectedProvisionalIds].sort())) throw new Error("Current provisional IDs mismatch");
  for (const id of excludedRuleIds) {
    const row = rows.find((r) => r.stableRuleId === id);
    if (row?.reviewStatus !== "PROVISIONAL" || !JSON.stringify(row).includes("Appendix 17")) throw new Error(`Appendix 17 blocker missing: ${id}`);
  }
  return { total: 58, unique: 58, reviewed: expectedReviewed, provisional: expectedProvisional, provisionalIds };
}

function loadTruth(commit?: string): Row[] {
  return truthFiles.flatMap((file) => JSON.parse((commit ? frozenBytes(file) : bytes(file)).toString("utf8")).decisions as Row[]);
}

function compareTruthRows(currentRows: Row[], historicalRows: Row[]) {
  if (currentRows.length !== 58) throw new Error(`Current truth row count changed: ${currentRows.length}`);
  if (historicalRows.length !== 58) throw new Error(`Historical truth row count changed: ${historicalRows.length}`);
  const currentIds = currentRows.map((row) => row.stableRuleId).sort();
  const historicalIds = historicalRows.map((row) => row.stableRuleId).sort();
  if (JSON.stringify(currentIds) !== JSON.stringify(historicalIds)) throw new Error("Historical truth row IDs changed");
  const currentById = new Map(currentRows.map((row) => [row.stableRuleId, row]));
  const historicalById = new Map(historicalRows.map((row) => [row.stableRuleId, row]));
  if (currentById.size !== 58) throw new Error(`Current truth row identity changed: ${currentById.size}`);
  if (historicalById.size !== 58) throw new Error(`Historical truth row identity changed: ${historicalById.size}`);
  for (const id of currentIds) {
    const current = currentById.get(id);
    const historical = historicalById.get(id);
    if (!current || !historical) {
      throw new Error(`Historical truth row changed: ${id}`);
    }
    if (selectedRuleIds.includes(id as typeof selectedRuleIds[number])) {
      if (sha256(JSON.stringify(current)) !== authorizedFinalRowSha256[id]) throw new Error(`authorized final row changed: ${id}`);
      continue;
    }
    if (JSON.stringify(current) !== JSON.stringify(historical)) throw new Error(`Historical truth row changed: ${id}`);
  }
}

function assertFrozenProvisionalRowsUnchanged(currentRows: Row[], historicalRows: Row[]) {
  const currentById = new Map(currentRows.map((row) => [row.stableRuleId, row]));
  const historicalById = new Map(historicalRows.map((row) => [row.stableRuleId, row]));
  for (const id of [...selectedRuleIds, ...excludedRuleIds]) {
    const current = currentById.get(id);
    const historical = historicalById.get(id);
    if (selectedRuleIds.includes(id as typeof selectedRuleIds[number])) {
      if (sha256(JSON.stringify(current)) !== authorizedFinalRowSha256[id]) throw new Error(`authorized final row changed: ${id}`);
      continue;
    }
    if (!current || !historical || JSON.stringify(current) !== JSON.stringify(historical)) {
      throw new Error(`Frozen provisional truth row changed: ${id}`);
    }
  }
}

function bootstrapSnapshot(): void {
  const rules = read<Row[]>(rulesPath);
  const selected = selectedRuleIds.map((id) => rules.find((r) => r.id === id));
  if (selected.some((r) => !r)) throw new Error("Cannot bootstrap missing rule contract");
  fs.mkdirSync(path.dirname(absolute(contractSnapshotPath)), { recursive: true });
  writeJson(absolute(contractSnapshotPath), { schemaVersion: "rc5-2-selected-rule-contract-baseline-v2", sourceCommit: baselineCommit, sourcePath: rulesPath, contracts: selected });
}

function validateContractSnapshot(rules: Row[]) {
  if (!fs.existsSync(absolute(contractSnapshotPath))) throw new Error(`Missing immutable contract snapshot: ${contractSnapshotPath}`);
  const snapshot = read<{ contracts: Row[] }>(contractSnapshotPath);
  const snapshotSha = sha256(bytes(contractSnapshotPath));
  const expectedSnapshotSha = "becf6264b6f94dc0c3dc1b44caa386fbf6ebe4b367ce707d312bcfe2aaebfd2c";
  if (snapshotSha !== expectedSnapshotSha) throw new Error("Contract snapshot SHA changed");
  for (const id of selectedRuleIds) {
    const current = rules.find((r) => r.id === id);
    const baseline = snapshot.contracts.find((r) => r.id === id);
    if (!current || !baseline || JSON.stringify(current) !== JSON.stringify(baseline)) throw new Error(`Current rule contract differs from immutable baseline: ${id}`);
  }
  return { path: contractSnapshotPath, sha256: snapshotSha, sourceCommit: baselineCommit };
}

function sourceEvidence(sourcePath: string, sourcePdf: string, pages: Page[], selectedPages: number[]) {
  const sourceSha256 = sha256(bytes(sourcePath)); const sourcePdfSha256 = sha256(bytes(sourcePdf));
  return selectedPages.map((page) => {
    const found = pages.find((p) => p.pageNumber === page);
    if (!found) throw new Error(`Missing source page ${page}: ${sourcePath}`);
    return { sourcePath, sourceSha256, sourcePdfPath: sourcePdf, sourcePdfSha256, page, completeExactQuote: found.text };
  });
}

function exactObjectSchema<T extends object>(value: T) {
  return { const: value };
}

function evidenceItemsSchema(evidence: EvidenceObject[]) {
  return { anyOf: evidence.map((item) => exactObjectSchema(item)) };
}

function decisionSchema(rule: ReturnType<typeof buildArtifacts>["packet"]["rules"][number]) {
  const allowedEvidence = [...rule.authoritativeMethodologyEvidence, ...rule.mayaProjectEvidence] as EvidenceObject[];
  const exactEvidenceArray = { type: "array", uniqueItems: true, items: evidenceItemsSchema(allowedEvidence) };
  const base = {
    type: "object",
    additionalProperties: false,
    required: ["stableRuleId", "machineRowSha256", "reviewStatus", "expertReviewRequired", "finalEvidenceState", "finalApplicability", "reviewerOutcome", "acceptedEvidence", "rejectedEvidence", "assessmentReason", "gap", "clientAction", "correctionReason", "provisionalReason", "reviewerConfidence"],
    properties: {
      stableRuleId: { const: rule.stableRuleId },
      machineRowSha256: { const: rule.machineRowSha256 },
      reviewStatus: { enum: ["PROVISIONAL", "REVIEWED"] },
      expertReviewRequired: { const: true },
      finalEvidenceState: { enum: ["FOUND", "UNCLEAR", "MISSING", "N/A", null] },
      finalApplicability: { enum: ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN", null] },
      reviewerOutcome: { enum: ["CONFORMS", "ACTION_REQUIRED", "NOT_APPLICABLE", null] },
      acceptedEvidence: exactEvidenceArray,
      rejectedEvidence: exactEvidenceArray,
      assessmentReason: { type: ["string", "null"] },
      gap: { type: ["string", "null"] },
      clientAction: { type: ["string", "null"] },
      correctionReason: { type: ["string", "null"] },
      provisionalReason: { type: ["string", "null"] },
      reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH", null] },
    },
    oneOf: [
      {
        properties: {
          reviewStatus: { const: "PROVISIONAL" },
          finalEvidenceState: { const: null },
          finalApplicability: { const: null },
          reviewerOutcome: { const: null },
          assessmentReason: { type: ["string", "null"] },
          provisionalReason: { type: "string", minLength: 1 },
          reviewerConfidence: { const: null },
        },
      },
      {
        properties: {
          reviewStatus: { const: "REVIEWED" },
          finalEvidenceState: { const: "FOUND" },
          finalApplicability: { const: "APPLICABLE" },
          reviewerOutcome: { const: "CONFORMS" },
          assessmentReason: { type: "string", minLength: 1 },
          provisionalReason: { const: null },
          reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
      {
        properties: {
          reviewStatus: { const: "REVIEWED" },
          finalEvidenceState: { const: "UNCLEAR" },
          finalApplicability: { enum: ["APPLICABLE", "UNKNOWN"] },
          reviewerOutcome: { const: "ACTION_REQUIRED" },
          assessmentReason: { type: "string", minLength: 1 },
          provisionalReason: { const: null },
          reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
      {
        properties: {
          reviewStatus: { const: "REVIEWED" },
          finalEvidenceState: { const: "MISSING" },
          finalApplicability: { enum: ["APPLICABLE", "UNKNOWN"] },
          reviewerOutcome: { const: "ACTION_REQUIRED" },
          assessmentReason: { type: "string", minLength: 1 },
          provisionalReason: { const: null },
          reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
      {
        properties: {
          reviewStatus: { const: "REVIEWED" },
          finalEvidenceState: { const: "N/A" },
          finalApplicability: { const: "NOT_APPLICABLE" },
          reviewerOutcome: { const: "NOT_APPLICABLE" },
          assessmentReason: { type: "string", minLength: 1 },
          provisionalReason: { const: null },
          reviewerConfidence: { enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
    ],
  };
  return base;
}

function assertFrozenSources(): void {
  for (const [sourcePath, expected] of Object.entries(expectedSourceSha)) if (sha256(bytes(sourcePath)) !== expected) throw new Error(`Frozen source SHA changed: ${sourcePath}`);
}

export function buildArtifacts() {
  assertFrozenSources();
  const currentRows = loadTruth();
  const historicalRows = loadTruth(baselineCommit);
  compareTruthRows(currentRows, historicalRows);
  const currentInventory = inventory(historicalRows, 52, 6, [...selectedRuleIds]);
  const historicalInventory = inventory(historicalRows, 52, 6, [...selectedRuleIds]);
  const frozenInventory = historicalInventory;
  assertFrozenProvisionalRowsUnchanged(currentRows, historicalRows);
  const rules = read<Row[]>(rulesPath);
  const contractSnapshot = validateContractSnapshot(rules);
  const extraction = read<{ pages: Page[] }>(extractionPath);
  const methodologyPagesData = read<{ pages: Page[] }>(vmPagesPath);
  const proposal = read<{ rows: Row[] }>(proposalPath);
  if (sha256(bytes(proposalPath)) !== machineSha) throw new Error("Machine proposal SHA changed");
  const methodologyEvidence = sourceEvidence(vmPagesPath, vmPdfPath, methodologyPagesData.pages, methodologyPages);
  const document = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: sha256(bytes(pddPath)) };
  const packetRules = selectedRuleIds.map((id) => {
    const contract = rules.find((r) => r.id === id)!; const machineRow = proposal.rows.find((r) => r.stableRuleId === id);
    if (!machineRow) throw new Error(`Missing machine row: ${id}`);
    const pddEvidence = sourceEvidence(extractionPath, pddPath, extraction.pages, pddPages[short(id)]);
    return { stableRuleId: id, question: questions[short(id)], methodologyContract: contract, methodologyContractProvenance: { sourcePath: rulesPath, sourceSha256: sha256(bytes(rulesPath)), baselineSnapshotPath: contractSnapshot.path, baselineSnapshotSha256: contractSnapshot.sha256, baselineSourceCommit: contractSnapshot.sourceCommit }, authoritativeMethodologyEvidence: methodologyEvidence, mayaProjectEvidence: pddEvidence, machineRowSha256: sha256(JSON.stringify(machineRow)) };
  });
  const machineProposal = { path: proposalPath, sha256: machineSha, proposalState: "MACHINE_PROPOSED" };
  const packet = {
    schemaVersion: "rc5-2-maya-remaining-five-review-packet-v1",
    reviewPurpose: "Independent review packet only. The reviewer must decide exactly five rules from the pinned methodology and Maya evidence. No judgment is integrated.",
    independence: { reviewedTruthIncluded: false, priorResponsesIncluded: false, machineJudgmentsIncluded: false },
    selectedRuleIds: [...selectedRuleIds], excludedRuleIds: [...excludedRuleIds], frozenInventory,
    frozenMachineProposal: machineProposal, sourceDocument: document,
    officialMethodology: { pdfPath: vmPdfPath, pdfSha256: sha256(bytes(vmPdfPath)), extractedPagesPath: vmPagesPath, extractedPagesSha256: sha256(bytes(vmPagesPath)), completeEvidencePages: methodologyPages },
    rules: packetRules,
    absentEvidence: ["Boundary KML/shapefiles and other external boundary-registration evidence are not in the frozen source set.", "Underlying RRD/LIC data and Appendix XYZ are not in the frozen source set.", "Appendices 21 and 22 and any external T-SIG workbooks are not in the frozen source set.", "No separate VCS JNR eligibility/data package is in the frozen source set."],
    reviewBoundary: { exactlySixUniqueDecisions: true, allowedFinalJudgments: ["REVIEWED + FOUND + CONFORMS", "REVIEWED + UNCLEAR + ACTION_REQUIRED", "REVIEWED + MISSING + ACTION_REQUIRED", "REVIEWED + NOT_APPLICABLE"], provisionalUse: "Only for genuinely unresolved authoritative interpretation or unavailable evidence that prevents a defensible final judgment.", appendix17BlockersAreUnresolvedQuestions: true },
  };
  const schemaVersion = "rc5-2-maya-remaining-five-review-response-v1";
  const responseSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaVersion,
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "sourceDocument", "machineProposalRef", "decisions"],
    properties: {
      schemaVersion: { const: schemaVersion },
      sourceDocument: { const: document },
      machineProposalRef: { const: machineProposal },
      decisions: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: { anyOf: packetRules.map((rule) => decisionSchema(rule)) },
        description: "Exactly six decisions, one unique decision for each selectedRuleId.",
      },
    },
    allOf: selectedRuleIds.map((id) => ({
      properties: {
        decisions: {
          contains: {
            type: "object",
            properties: { stableRuleId: { const: id } },
            required: ["stableRuleId"],
          },
          minContains: 1,
          maxContains: 1,
        },
      },
    })),
  };
  const blank = (id: string) => ({ stableRuleId: id, machineRowSha256: packetRules.find((r) => r.stableRuleId === id)!.machineRowSha256, reviewStatus: "PENDING_INDEPENDENT_ADJUDICATION", expertReviewRequired: true, finalEvidenceState: null, finalApplicability: null, reviewerOutcome: null, acceptedEvidence: [], rejectedEvidence: [], assessmentReason: null, gap: null, clientAction: null, correctionReason: null, provisionalReason: null, reviewerConfidence: null });
  const template = { schemaVersion, sourceDocument: document, machineProposalRef: machineProposal, decisions: selectedRuleIds.map(blank) };
  const instructions = `# RC5-2 Maya independent review — remaining six\n\nReturn exactly six unique decisions, one for each selected rule ID in the packet. Review the complete contiguous VM0007 v1.8 evidence pages and the complete exact Maya project evidence objects. Do not consult or infer an answer from reviewed truth, prior responses, or machine judgments. For R-3-0001 and R-4-0001, treat Appendix 17 blockers as unresolved questions, not assumptions; independently determine evidence state, applicability, outcome, accepted/rejected evidence, gaps, client actions, and confidence.\n\nFor each rule, select one final judgment: REVIEWED + FOUND + CONFORMS; REVIEWED + UNCLEAR + ACTION_REQUIRED; REVIEWED + MISSING + ACTION_REQUIRED; or REVIEWED + NOT_APPLICABLE. Use PROVISIONAL only when an authoritative interpretation remains genuinely unresolved or unavailable evidence prevents a defensible final judgment. Cite the exact source path, whole-file SHA, page, and complete quote for every material conclusion.\n`;
  const manifest = { schemaVersion: "rc5-2-maya-remaining-five-review-manifest-v1", baselineCommit, selectedRuleIds: [...selectedRuleIds], excludedRuleIds: [...excludedRuleIds], inventory: frozenInventory, historicalTruth: { files: truthFiles, commit: baselineCommit, sha256: Object.fromEntries(truthFiles.map((f) => [f, sha256(frozenBytes(f))])) }, sources: { machineProposal: { path: proposalPath, sha256: machineSha }, ruleContracts: { path: rulesPath, sha256: sha256(bytes(rulesPath)), baselineSnapshot: contractSnapshot }, methodologyPdf: { path: vmPdfPath, sha256: sha256(bytes(vmPdfPath)) }, methodologyPages: { path: vmPagesPath, sha256: sha256(bytes(vmPagesPath)) }, mayaPdd: { path: pddPath, sha256: sha256(bytes(pddPath)) }, mayaExtraction: { path: extractionPath, sha256: sha256(bytes(extractionPath)) } }, responseValidator: { cliPath: responseValidatorCliPath, cliSha256: sha256(bytes(responseValidatorCliPath)), implementationPath: responseValidatorImplementationPath, implementationSha256: sha256(bytes(responseValidatorImplementationPath)) }, generatedFiles: { packet: "review-packet.json", instructions: "reviewer-instructions.md", responseSchema: "review-response-schema.json", template: "review-template.json" }, reviewedTruthEmbedded: false, priorResponsesEmbedded: false };
  return { packet, responseSchema, template, instructions, manifest };
}

export function writeArtifacts(outputDir = packetDir) {
  const a = buildArtifacts(); fs.mkdirSync(outputDir, { recursive: true });
  writeJson(path.join(outputDir, "review-packet.json"), a.packet); fs.writeFileSync(path.join(outputDir, "reviewer-instructions.md"), a.instructions); writeJson(path.join(outputDir, "review-response-schema.json"), a.responseSchema); writeJson(path.join(outputDir, "review-template.json"), a.template);
  const files = ["review-packet.json", "reviewer-instructions.md", "review-response-schema.json", "review-template.json"];
  const manifest = { ...a.manifest, generatedFileSha256: Object.fromEntries(files.map((f) => [f, sha256(fs.readFileSync(path.join(outputDir, f)))])) };
  writeJson(path.join(outputDir, "manifest.json"), manifest);
  return { packetSha256: sha256(fs.readFileSync(path.join(outputDir, "review-packet.json"))), manifestSha256: sha256(fs.readFileSync(path.join(outputDir, "manifest.json"))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--bootstrap-contract-snapshot")) bootstrapSnapshot();
  else writeArtifacts();
}
