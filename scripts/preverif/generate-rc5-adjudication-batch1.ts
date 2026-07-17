import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";
import { readRc5BatchSelection } from "./rc5-batch-selection-manifest";

const root = process.cwd();
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const canonicalSchemaPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-adjudication-response-schema.json");
const templatePath = path.join(packetDir, "review-template.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");

export function assertBatch1GeneratedRuleCoverage(generatedDecisionIds: string[]): string[] {
  const frozenExpectedRuleIds = readRc5BatchSelection(1);
  assertRc5RuleCoverage(generatedDecisionIds, frozenExpectedRuleIds, "RC5 Batch 1 template");
  return frozenExpectedRuleIds;
}

export function generateBatch1Artifacts(): void {
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as {
  schemaVersion: string;
  sourceDocument: { documentId: string; documentName: string; contentSha256: string };
  machineProposalRef: { path: string; sha256: string; proposalState: "MACHINE_PROPOSED" };
  decisions: Array<Record<string, unknown> & { stableRuleId: string }>;
};
  const proposalSha256 = crypto.createHash("sha256").update(fs.readFileSync(proposalPath)).digest("hex");
  if (template.machineProposalRef.sha256 !== proposalSha256) throw new Error("RC5 Batch 1 template proposal SHA does not match frozen proposal");
  const frozenExpectedRuleIds = assertBatch1GeneratedRuleCoverage(template.decisions.map((decision) => decision.stableRuleId));
  const canonicalTemplate = {
  ...template,
  decisions: template.decisions.map((decision) => ({
    ...decision,
    reviewStatus: decision.reviewStatus ?? "PENDING_INDEPENDENT_ADJUDICATION",
    expertReviewRequired: decision.expertReviewRequired ?? true,
    provisionalReason: decision.provisionalReason ?? null,
  })),
};
  const schema = buildRc5AdjudicationResponseSchema({
  schemaVersion: canonicalTemplate.schemaVersion,
  document: canonicalTemplate.sourceDocument,
  machineProposalRef: canonicalTemplate.machineProposalRef,
  ruleIds: frozenExpectedRuleIds,
  decisionCount: canonicalTemplate.decisions.length,
});

  fs.writeFileSync(path.join(packetDir, "review-response-schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
  fs.writeFileSync(canonicalSchemaPath, `${JSON.stringify(schema, null, 2)}\n`);
  fs.writeFileSync(templatePath, `${JSON.stringify(canonicalTemplate, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) generateBatch1Artifacts();
