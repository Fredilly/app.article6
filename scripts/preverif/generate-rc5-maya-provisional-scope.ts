import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
export const scopeDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-provisional-independent-review-scope");
const machineTruthPath = "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json";
const reviewedTruthFiles = [
  "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/maya-adjudication-response.json",
  ...[2, 3, 4, 5, 6].map((batch) => `docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-${batch}-adjudication/reviewed-truth.json`),
];

type Decision = {
  stableRuleId: string;
  reviewStatus: string;
  finalEvidenceState: string | null;
  finalApplicability: string | null;
  reviewerOutcome: string | null;
  provisionalReason: string | null;
  acceptedEvidence: unknown[];
  rejectedEvidence: unknown[];
};

const groupByRule: Record<string, { group: "CAN_FINALIZE_FROM_EXISTING_PACKET" | "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL" | "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION" | "BLOCKED_BY_PROVENANCE_OR_SCHEMA"; packetSufficiency: boolean; scopeReason: string }> = {
  "Verra.AFOLU.VM0007.v1-8.R-1-0012": { group: "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION", packetSufficiency: false, scopeReason: "Existing evidence supports a WRC-scope question, but the rule-to-activity mapping needs methodology interpretation." },
  "Verra.AFOLU.VM0007.v1-8.R-1-0013": { group: "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION", packetSufficiency: false, scopeReason: "Existing evidence supports a wetland-scope question, but the rule-to-activity mapping needs methodology interpretation." },
  "Verra.AFOLU.VM0007.v1-8.R-1-0014": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen module-selection evidence is directly available for an independent exclusion review." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0002": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing boundary-exclusivity evidence from the full boundary section." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0003": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The packet covers inter-program double counting but identifies a missing intra-project exclusion component." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0004": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing RRD data in the baseline quantification section." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0005": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing proxy-area data in the baseline quantification section." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0006": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing explicit strata definitions in the baseline quantification section." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0007": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The packet requires cross-reference of pool inclusion/exclusion against methodology-mandatory pools." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0008": { group: "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION", packetSufficiency: false, scopeReason: "The packet identifies a conditional HWP applicability question requiring methodology interpretation." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0009": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0010": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0011": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0012": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0013": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing fixed-baseline modeling-period evidence." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0014": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing crediting-period evidence." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0015": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-2-0016": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen applicability evidence directly addresses the WRC/tidal scope question." },
  "Verra.AFOLU.VM0007.v1-8.R-3-0001": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing VT0001 Steps 2–4 analysis." },
  "Verra.AFOLU.VM0007.v1-8.R-3-0002": { group: "CAN_FINALIZE_FROM_EXISTING_PACKET", packetSufficiency: true, scopeReason: "The frozen packet contains the three listed alternatives for independent completeness review." },
  "Verra.AFOLU.VM0007.v1-8.R-3-0003": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing VT0001 analysis steps beyond the listed alternatives." },
  "Verra.AFOLU.VM0007.v1-8.R-3-0004": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing VT0001 analysis steps beyond the listed alternatives." },
  "Verra.AFOLU.VM0007.v1-8.R-3-0008": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The packet contains no JNR-data evidence; full-PDD retrieval is required before review." },
  "Verra.AFOLU.VM0007.v1-8.R-4-0001": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies missing full VT0001 Steps 2–4 analysis." },
  "Verra.AFOLU.VM0007.v1-8.R-5-0001": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The provisional reason identifies a missing complete net-emission-reduction decomposition." },
  "Verra.AFOLU.VM0007.v1-8.R-5-0003": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The packet has no evidence for leakage-component identification." },
  "Verra.AFOLU.VM0007.v1-8.R-5-0005": { group: "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", packetSufficiency: false, scopeReason: "The packet has no evidence for buffer-component quantification." },
};

const batches = [
  { batch: 1, files: [reviewedTruthFiles[0]] },
  ...[2, 3, 4, 5, 6].map((batch, index) => ({ batch, files: [reviewedTruthFiles[index + 1]] })),
];
const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");

export function buildScopeManifest() {
  const decisions = batches.flatMap(({ batch, files }) => files.flatMap((file) => read<{ decisions: Decision[] }>(path.join(root, file)).decisions.map((decision) => ({ ...decision, batch }))));
  const provisional = decisions.filter((decision) => decision.reviewStatus === "PROVISIONAL");
  if (decisions.length !== 58) throw new Error(`Expected 58 decisions, got ${decisions.length}`);
  if (new Set(decisions.map((decision) => decision.stableRuleId)).size !== 58) throw new Error("Reviewed-truth inventory contains duplicate rule IDs");
  if (provisional.length !== 27) throw new Error(`Expected 27 provisional rules, got ${provisional.length}`);
  const rules = provisional.map((decision) => {
    const scope = groupByRule[decision.stableRuleId];
    if (!scope) throw new Error(`Missing deterministic scope classification for ${decision.stableRuleId}`);
    return { stableRuleId: decision.stableRuleId, batch: decision.batch, reviewStatus: decision.reviewStatus, currentEvidenceState: decision.finalEvidenceState, currentApplicability: decision.finalApplicability, currentReviewerOutcome: decision.reviewerOutcome, provisionalReason: decision.provisionalReason, acceptedEvidenceCount: decision.acceptedEvidence.length, rejectedEvidenceCount: decision.rejectedEvidence.length, existingFrozenPacketSufficientForIndependentReview: scope.packetSufficiency, scopeGroup: scope.group, scopeReason: scope.scopeReason };
  });
  const sorted = rules.sort((a, b) => a.stableRuleId.localeCompare(b.stableRuleId));
  return { schemaVersion: "rc5-maya-provisional-independent-review-scope-v1", purpose: "Deterministic scope inventory for the 27 remaining Maya provisional rules. This manifest contains no new judgments and does not modify reviewed or machine truth.", sourceCommitSha: "13fbf5f2a75dd226318549f43b98fcde3b535973", machineTruth: { path: machineTruthPath, sha256: sha256(fs.readFileSync(path.join(root, machineTruthPath))), proposalState: "MACHINE_PROPOSED" }, inventory: { totalRules: decisions.length, uniqueRuleCount: new Set(decisions.map((decision) => decision.stableRuleId)).size, reviewedRuleCount: decisions.filter((decision) => decision.reviewStatus === "REVIEWED").length, provisionalRuleCount: provisional.length }, groupCounts: Object.fromEntries(["CAN_FINALIZE_FROM_EXISTING_PACKET", "REQUIRES_TARGETED_FULL_PDD_RETRIEVAL", "REQUIRES_METHODOLOGY_EXPERT_INTERPRETATION", "BLOCKED_BY_PROVENANCE_OR_SCHEMA"].map((group) => [group, sorted.filter((rule) => rule.scopeGroup === group).length])), rules: sorted, recommendedBatches: [
    { batch: "next-1", purpose: "Existing-packet independent review", ruleIds: ["Verra.AFOLU.VM0007.v1-8.R-1-0014", "Verra.AFOLU.VM0007.v1-8.R-2-0009", "Verra.AFOLU.VM0007.v1-8.R-2-0010", "Verra.AFOLU.VM0007.v1-8.R-2-0011", "Verra.AFOLU.VM0007.v1-8.R-2-0012", "Verra.AFOLU.VM0007.v1-8.R-2-0015", "Verra.AFOLU.VM0007.v1-8.R-2-0016", "Verra.AFOLU.VM0007.v1-8.R-3-0002"] },
    { batch: "next-2", purpose: "Targeted baseline and quantification retrieval", ruleIds: ["Verra.AFOLU.VM0007.v1-8.R-2-0002", "Verra.AFOLU.VM0007.v1-8.R-2-0003", "Verra.AFOLU.VM0007.v1-8.R-2-0004", "Verra.AFOLU.VM0007.v1-8.R-2-0005", "Verra.AFOLU.VM0007.v1-8.R-2-0006", "Verra.AFOLU.VM0007.v1-8.R-2-0007", "Verra.AFOLU.VM0007.v1-8.R-2-0013", "Verra.AFOLU.VM0007.v1-8.R-2-0014", "Verra.AFOLU.VM0007.v1-8.R-4-0001"] },
    { batch: "next-3", purpose: "Targeted VT0001/JNR/leakage retrieval plus methodology interpretation", ruleIds: ["Verra.AFOLU.VM0007.v1-8.R-1-0012", "Verra.AFOLU.VM0007.v1-8.R-1-0013", "Verra.AFOLU.VM0007.v1-8.R-2-0008", "Verra.AFOLU.VM0007.v1-8.R-3-0001", "Verra.AFOLU.VM0007.v1-8.R-3-0003", "Verra.AFOLU.VM0007.v1-8.R-3-0004", "Verra.AFOLU.VM0007.v1-8.R-3-0008", "Verra.AFOLU.VM0007.v1-8.R-5-0001", "Verra.AFOLU.VM0007.v1-8.R-5-0003", "Verra.AFOLU.VM0007.v1-8.R-5-0005"] },
  ] };
}

export function writeScopeManifest(outputDir = scopeDir) {
  const manifest = buildScopeManifest();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) writeScopeManifest();
