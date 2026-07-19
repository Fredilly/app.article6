import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-methodology-expert-finalization-batch-2");
const mergedCommit = "827a95004d13870a5987443d7597d1a0ecc1d397";
const originalPacketCommit = "cc371bd4aeb1b56bb50592d093b337c6f199acf9";
const originalTruthCommit = "d2ecd198a3d007433d933717b8e07f1d19774978";
const methodologyArtifactRef = "immutable-methodology-pack:Verra/AFOLU/VM0007@v1-8";
const scopePath = "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope/manifest.json";
const scopeSha256 = "f3fd97e932eb6a023c302313f5f4df5cad286751994b469f502226f1bc00e21a";
const originalPacketPath = "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-3-adjudication/review-packet.json";
const originalPacketSha256 = "403a810a02fcf5c259c73c30e7db7b2380577d1d02eb650aea62f0298435a99f";
const originalTruthPath = "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-batch-3-adjudication/reviewed-truth.json";
const originalTruthSha256 = "d02dc6dcbd608a6080ea6601849d3d2c58d0743fe09fa7a5c13db404662731a5";
const machineProposalPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
const machineProposalSha256 = "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b";
const methodologyRulesPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/rules.rich.json";
const methodologyRulesSha256 = "9fceaa1dc458c847c1236fad73215f56b924ebbec794850b60c0510ace7d0e49";
const methodologySectionsPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/sections.rich.json";
const methodologySectionsSha256 = "4506bb488417a940fc4e84228bff7abcc7e7921fcb9a824fa140bf6e2687b5e3";
const methodologyMetaPath = "public/methodologies/Verra/AFOLU/VM0007/v1-8/META.json";
const methodologyMetaSha256 = "0b426189afb549bcb0af65efac74c69ceabdb9ee6026efd3d6494788d9a19839";
const pddPath = "tests/fixtures/quick-check/v2/maya-forest-corridor-redd-belize/source.pdf";
const pddSha256 = "407caaa782e9d9e07b250999539fc809c2c41888b0f20a628a9e49dbeb977a5b";

export const selectedRuleIds = [
  "Verra.AFOLU.VM0007.v1-8.R-1-0012",
  "Verra.AFOLU.VM0007.v1-8.R-1-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
] as const;

const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const write = (filePath: string, value: unknown): void => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);

type Input = { commitSha: string; path: string; sha256: string };
type LocalInput = { artifactRef: string; path: string; sha256: string };
const gitBytes = (input: Input): Buffer => {
  const bytes = execFileSync("git", ["show", `${input.commitSha}:${input.path}`]);
  if (sha256(bytes) !== input.sha256) throw new Error(`Pinned input SHA mismatch: ${input.commitSha}:${input.path}`);
  return bytes;
};
const gitJson = <T>(input: Input): T => JSON.parse(gitBytes(input).toString("utf8")) as T;
const localBytes = (input: LocalInput): Buffer => {
  const bytes = fs.readFileSync(path.join(root, input.path));
  if (sha256(bytes) !== input.sha256) throw new Error(`Pinned methodology artifact SHA mismatch: ${input.path}`);
  return bytes;
};
const localJson = <T>(input: LocalInput): T => JSON.parse(localBytes(input).toString("utf8")) as T;

const inputs = {
  scope: { commitSha: mergedCommit, path: scopePath, sha256: scopeSha256 },
  originalPacket: { commitSha: originalPacketCommit, path: originalPacketPath, sha256: originalPacketSha256 },
  originalTruth: { commitSha: originalTruthCommit, path: originalTruthPath, sha256: originalTruthSha256 },
  machineProposal: { commitSha: mergedCommit, path: machineProposalPath, sha256: machineProposalSha256 },
  methodologyRules: { artifactRef: methodologyArtifactRef, path: methodologyRulesPath, sha256: methodologyRulesSha256 },
  methodologySections: { artifactRef: methodologyArtifactRef, path: methodologySectionsPath, sha256: methodologySectionsSha256 },
  methodologyMeta: { artifactRef: methodologyArtifactRef, path: methodologyMetaPath, sha256: methodologyMetaSha256 },
  pdd: { artifactRef: `git-object:${mergedCommit}`, path: pddPath, sha256: pddSha256 },
} as const;

const expertQuestions: Record<string, string[]> = {
  "Verra.AFOLU.VM0007.v1-8.R-1-0012": [
    "Is the phrase “conservation activity type” in this requirement exclusively a WRC concept, or can it apply to other VM0007 activity categories?",
    "On the methodology text alone, does this rule have any application to a REDD/APDef project? Please identify the applicability chain that supports the answer.",
    "What project evidence is sufficient to determine applicability without inferring an outcome from the existing candidate excerpts?",
  ],
  "Verra.AFOLU.VM0007.v1-8.R-1-0013": [
    "Is this requirement limited to wetland degradation/WRC activities, or does VM0007 apply it to any other activity category?",
    "On the methodology text alone, does this rule have any REDD/APDef application? Please identify the applicability chain that supports the answer.",
    "What project evidence is sufficient to determine applicability, including the evidence needed to distinguish activity category from site characteristics?",
  ],
  "Verra.AFOLU.VM0007.v1-8.R-2-0008": [
    "Under VM0007, when are harvested wood products mandatory, when may they be omitted as insignificant or otherwise optional, and when are they excluded?",
    "What facts about the Maya project would establish whether the harvested-wood-product condition is triggered?",
    "Is the existing project evidence sufficient to determine that condition, and if not, what precise evidence is missing?",
  ],
};

const sourceDocument = { documentId: "quick-check-review-question", documentName: "12-maya-forest-corridor-redd-belize.pdf", contentSha256: pddSha256 };

function neutralCandidateEvidence(rule: any): any[] {
  const candidates = [...(rule.acceptedEvidence ?? []), ...(rule.rejectedEvidence ?? [])];
  const seen = new Set<string>();
  return candidates.flatMap((candidate: any) => {
    const provenance = candidate.provenance ?? {};
    const item = {
      quote: candidate.quote,
      page: candidate.page,
      sectionHeading: provenance.sectionHeading ?? candidate.section,
      spanId: candidate.spanId ?? provenance.spanId,
      sourceDocument,
      provenance: {
        documentId: sourceDocument.documentId,
        documentSha256: sourceDocument.contentSha256,
        page: candidate.page,
        sectionHeading: provenance.sectionHeading ?? candidate.section,
        spanId: candidate.spanId ?? provenance.spanId,
        sourceType: provenance.sourceType ?? "PDD",
      },
    };
    const key = JSON.stringify(item);
    if (seen.has(key)) return [];
    seen.add(key);
    return [item];
  });
}

export function buildArtifacts() {
  const scope = gitJson<any>(inputs.scope);
  if (scope.inventory.reviewedRuleCount !== 39 || scope.inventory.provisionalRuleCount !== 19) throw new Error("Merged scope inventory changed");
  if (JSON.stringify(scope.groupCounts) !== JSON.stringify({ CAN_FINALIZE_FROM_EXISTING_PACKET: 0, REQUIRES_TARGETED_FULL_PDD_RETRIEVAL: 16, REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION: 3, BLOCKED_BY_PROVENANCE_OR_SCHEMA: 0 })) throw new Error("Merged provisional scope counts changed");
  if (scope.machineTruth.sha256 !== machineProposalSha256) throw new Error("Merged machine proposal SHA changed");
  const selectedScope = scope.rules.filter((rule: any) => selectedRuleIds.includes(rule.stableRuleId));
  if (selectedScope.length !== selectedRuleIds.length || selectedScope.some((rule: any) => rule.scopeGroup !== "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION" || rule.reviewStatus !== "PROVISIONAL")) throw new Error("Selected IDs are not exactly the methodology-expert provisional scope");
  if (scope.rules.some((rule: any) => rule.scopeGroup === "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION" && !selectedRuleIds.includes(rule.stableRuleId))) throw new Error("Methodology-expert scope contains an unexpected rule");

  const originalPacket = gitJson<any>(inputs.originalPacket);
  const originalTruth = gitJson<any>(inputs.originalTruth);
  const machineProposal = gitJson<any>(inputs.machineProposal);
  const methodologyRules = localJson<any[]>(inputs.methodologyRules);
  const methodologySections = localJson<any[]>(inputs.methodologySections);
  localBytes(inputs.methodologyMeta);
  localBytes(inputs.pdd);
  const packetRules = selectedRuleIds.map((stableRuleId) => {
    const original = originalPacket.rules.find((rule: any) => rule.stableRuleId === stableRuleId);
    const methodology = methodologyRules.find((rule: any) => rule.id === stableRuleId);
    const machineRow = machineProposal.rows.find((row: any) => row.stableRuleId === stableRuleId);
    const truthRow = originalTruth.decisions.find((row: any) => row.stableRuleId === stableRuleId);
    if (!original || !methodology || !machineRow || !truthRow || truthRow.reviewStatus !== "PROVISIONAL") throw new Error(`Missing pinned source for ${stableRuleId}`);
    if (sha256(Buffer.from(JSON.stringify(machineRow))) !== original.frozenMachineRowHash) throw new Error(`Frozen machine-row hash mismatch for ${stableRuleId}`);
    const section = methodologySections.find((item: any) => item.id === methodology.refs.primary_section);
    return {
      stableRuleId,
      requirementText: methodology.source_span_text,
      ruleSummaryForOrientation: methodology.logic,
      methodologyExcerpts: [{
        sourcePath: methodologyRulesPath,
        sourceSha256: methodologyRulesSha256,
        methodologyId: "VM0007",
        methodologyVersion: "v1.8",
        sectionId: methodology.refs.primary_section,
        sectionNumber: methodology.section_context.section_number,
        sectionTitle: methodology.section_context.section_title,
        pageStart: methodology.section_context.page_start,
        pageEnd: methodology.section_context.page_end,
        exactText: methodology.source_span_text,
        moduleToolReferences: methodology.refs.tools,
      }, ...(section ? [{ sourcePath: methodologySectionsPath, sourceSha256: methodologySectionsSha256, sectionId: section.id, sectionNumber: section.section_number, sectionTitle: section.title, pageStart: section.page_start, pageEnd: section.page_end, exactText: `Section context: ${section.title}.` }] : [])],
      frozenMachineRowHash: original.frozenMachineRowHash,
      historicalMachineContext: { label: "NON_FINAL_HISTORICAL_MACHINE_CONTEXT", rowHash: original.frozenMachineRowHash },
      originalPacketCandidateEvidence: neutralCandidateEvidence(original),
      currentProvisionalQuestion: expertQuestions[stableRuleId],
      provenance: {
        methodology: { path: methodologyRulesPath, sha256: methodologyRulesSha256, artifactRef: methodologyArtifactRef },
        sourceDocument,
        originalBatch3Packet: { path: originalPacketPath, sha256: originalPacketSha256, commitSha: originalPacketCommit },
      },
    };
  });
  const packet = {
    schemaVersion: "rc5-2-maya-methodology-expert-finalization-batch-2-packet-v1",
    reviewPurpose: "Neutral, reproducible methodology-expert interpretation packet. No adjudication is included.",
    independenceNotice: "Candidate evidence is reproduced without accepted/rejected labels. Historical machine context is non-final and must not be treated as an outcome.",
    sourceDocument,
    rules: packetRules,
  };
  const template = { schemaVersion: "rc5-2-maya-methodology-expert-finalization-batch-2-response-v1", responses: selectedRuleIds.map((stableRuleId) => ({ stableRuleId, expertAnalysis: null, applicabilityDetermination: null, evidenceSufficiency: null, supportingEvidence: [], missingEvidence: [], notes: null })) };
  const responseSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object", additionalProperties: false,
    required: ["schemaVersion", "responses"],
    properties: { schemaVersion: { const: template.schemaVersion }, responses: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", additionalProperties: false, required: ["stableRuleId", "expertAnalysis", "applicabilityDetermination", "evidenceSufficiency", "supportingEvidence", "missingEvidence", "notes"], properties: { stableRuleId: { enum: [...selectedRuleIds] }, expertAnalysis: { type: ["string", "null"] }, applicabilityDetermination: { type: ["string", "null"] }, evidenceSufficiency: { type: ["string", "null"] }, supportingEvidence: { type: "array", items: { type: "object" } }, missingEvidence: { type: "array", items: { type: "string" } }, notes: { type: ["string", "null"] } } } } },
  };
  return { packet, template, responseSchema, scope, selectedScope };
}

export function writeArtifacts(outputDir = packetDir): string {
  const { packet, template, responseSchema, scope, selectedScope } = buildArtifacts();
  fs.mkdirSync(outputDir, { recursive: true });
  write(path.join(outputDir, "review-packet.json"), packet);
  write(path.join(outputDir, "review-template.json"), template);
  write(path.join(outputDir, "review-response-schema.json"), responseSchema);
  const generatedPacketSha256 = sha256(fs.readFileSync(path.join(outputDir, "review-packet.json")));
  write(path.join(outputDir, "manifest.json"), {
    schemaVersion: "rc5-2-maya-methodology-expert-finalization-batch-2-manifest-v1",
    purpose: "Pinned provenance and deterministic-generation manifest for a neutral expert packet.",
    selectedRuleIds: [...selectedRuleIds],
    selectedRuleScopeGroups: Object.fromEntries(selectedScope.map((rule: any) => [rule.stableRuleId, rule.scopeGroup])),
    mergedProvisionalScope: { commitSha: mergedCommit, path: scopePath, sha256: scopeSha256, inventory: scope.inventory, groupCounts: scope.groupCounts },
    historicalInputs: inputs,
    generatedPacketSha256,
    packetFiles: ["review-packet.json", "review-template.json", "review-response-schema.json", "manifest.json", "review-instructions.md"],
    reviewedTruthFilesCreated: false,
  });
  return generatedPacketSha256;
}

if (import.meta.url === `file://${process.argv[1]}`) writeArtifacts();
