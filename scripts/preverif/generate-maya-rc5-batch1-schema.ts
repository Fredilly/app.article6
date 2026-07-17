import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildMayaAdjudicationResponseSchema } from "./maya-adjudication-response-schema";

const root = process.cwd();
const packetDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-maya-adjudication");
const templatePath = path.join(packetDir, "review-template.json");
const proposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");

const template = JSON.parse(fs.readFileSync(templatePath, "utf8")) as {
  schemaVersion: string;
  sourceDocument: { documentId: string; documentName: string; contentSha256: string };
  machineProposalRef: { path: string; proposalState: "MACHINE_PROPOSED" };
  decisions: Array<{ stableRuleId: string }>;
};
const proposalSha256 = crypto.createHash("sha256").update(fs.readFileSync(proposalPath)).digest("hex");
const schema = buildMayaAdjudicationResponseSchema({
  schemaVersion: template.schemaVersion,
  document: template.sourceDocument,
  machineProposalRef: { ...template.machineProposalRef, sha256: proposalSha256 },
  ruleIds: template.decisions.map((decision) => decision.stableRuleId),
  decisionCount: template.decisions.length,
});

fs.writeFileSync(path.join(packetDir, "review-response-schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
