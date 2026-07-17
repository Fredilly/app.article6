import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertRc5RuleCoverage, buildRc5AdjudicationResponseSchema } from "./rc5-adjudication-response-schema";

const root = process.cwd();
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const canonicalSchemaPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-adjudication-response-schema.json");
const templatePath = path.join(packetDir, "review-template.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");

const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as {
  schemaVersion: string;
  sourceDocument: { documentId: string; documentName: string; contentSha256: string };
  machineProposalRef: { path: string; sha256: string; proposalState: "MACHINE_PROPOSED" };
  decisions: Array<Record<string, unknown> & { stableRuleId: string }>;
};
const proposalSha256 = crypto.createHash("sha256").update(fs.readFileSync(proposalPath)).digest("hex");
if (template.machineProposalRef.sha256 !== proposalSha256) throw new Error("RC5 Batch 1 template proposal SHA does not match frozen proposal");
const expectedRuleIds = template.decisions.map((decision) => decision.stableRuleId);
assertRc5RuleCoverage(expectedRuleIds, expectedRuleIds, "RC5 Batch 1 template");
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
  ruleIds: expectedRuleIds,
  decisionCount: canonicalTemplate.decisions.length,
});

fs.writeFileSync(path.join(packetDir, "review-response-schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
fs.writeFileSync(canonicalSchemaPath, `${JSON.stringify(schema, null, 2)}\n`);
fs.writeFileSync(templatePath, `${JSON.stringify(canonicalTemplate, null, 2)}\n`);
