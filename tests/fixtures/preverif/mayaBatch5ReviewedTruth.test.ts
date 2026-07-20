import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { readRc5BatchSelection } from "../../../scripts/preverif/rc5-batch-selection-manifest";
import { assertBatch3EvidenceProvenance, assertBatch3IntegratedRow, batch3RuleIds } from "./mayaBatch3ExpectedIntegration";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-5-adjudication");
const selectionManifestPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const reviewedTruthPath = path.join(batchDir, "reviewed-truth.json");
const reviewPacketPath = path.join(batchDir, "review-packet.json");
const reviewTemplatePath = path.join(batchDir, "review-template.json");
const reviewSchemaPath = path.join(batchDir, "review-response-schema.json");
const batchManifestPath = path.join(batchDir, "manifest.json");
const frozenProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");

const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const normalizeFrozenContext = (context: Record<string, any>) => {
  return {
    quote: context.exactQuote,
    page: context.pageNumber,
    sectionHeading: context.sectionHeading,
    spanId: context.sourceSpanId,
    documentId: context.documentIdentity.documentId,
    documentSha256: context.documentIdentity.contentSha256,
  };
};

const evidenceKey = (evidence: Record<string, any>) => JSON.stringify({
  quote: evidence.quote,
  page: evidence.page,
  sectionHeading: evidence.sectionHeading,
  spanId: evidence.spanId,
  documentId: evidence.documentId,
  documentSha256: evidence.documentSha256,
});
const wave1ReassessedRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-2-0007",
  "Verra.AFOLU.VM0007.v1-8.R-2-0008",
  "Verra.AFOLU.VM0007.v1-8.R-3-0001",
  "Verra.AFOLU.VM0007.v1-8.R-3-0003",
  "Verra.AFOLU.VM0007.v1-8.R-3-0004",
  "Verra.AFOLU.VM0007.v1-8.R-3-0008",
  "Verra.AFOLU.VM0007.v1-8.R-4-0001",
  "Verra.AFOLU.VM0007.v1-8.R-5-0003",
]);

function assertPacketEvidenceMembership(
  packetEvidencePool: Set<string>,
  stableRuleId: string,
  field: "acceptedEvidence" | "rejectedEvidence",
  evidenceIndex: number,
  evidence: Record<string, any>,
) {
  if (!packetEvidencePool.has(evidenceKey(evidence))) {
    throw new assert.AssertionError({
      message: `${stableRuleId} ${field}[${evidenceIndex}] has no exact frozen packet match`,
    });
  }
}

describe("RC5-2 Maya Batch 5 reviewed truth", () => {
  it("matches the frozen packet exactly and preserves the reviewed rule union", () => {
    const truth = read<Record<string, any>>(reviewedTruthPath);
    const packet = read<Record<string, any>>(reviewPacketPath);
    const template = read<Record<string, any>>(reviewTemplatePath);
    const schema = read<Record<string, any>>(reviewSchemaPath);
    const batchManifest = read<Record<string, any>>(batchManifestPath);
    const selectionManifest = read<Record<string, any>>(selectionManifestPath);
    const packetEvidencePool = new Set<string>();
    for (const context of Object.values(packet.contexts) as Array<Record<string, any>>) {
      packetEvidencePool.add(evidenceKey(normalizeFrozenContext(context)));
    }
    const priorRuleIds = new Set<string>([
      ...selectionManifest.batches["1"].expectedRuleIds,
      ...selectionManifest.batches["2"].expectedRuleIds,
      ...selectionManifest.batches["3"].expectedRuleIds,
      ...selectionManifest.batches["4"].expectedRuleIds,
    ]);
    const reviewedUnion = new Set<string>([
      ...selectionManifest.batches["1"].expectedRuleIds,
      ...selectionManifest.batches["2"].expectedRuleIds,
      ...selectionManifest.batches["3"].expectedRuleIds,
      ...selectionManifest.batches["4"].expectedRuleIds,
      ...selectionManifest.batches["5"].expectedRuleIds,
    ]);
    const validate = new Ajv2020({ strict: false }).compile(schema);

    assert.equal(validate(truth), true, JSON.stringify(validate.errors));
    assert.equal(truth.schemaVersion, schema.$id);
    assert.equal(truth.decisions.length, 10);
    assert.equal(new Set(truth.decisions.map((decision: any) => decision.stableRuleId)).size, 10);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), packet.selectedRuleIds);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), template.decisions.map((decision: any) => decision.stableRuleId));
    assert.deepEqual(truth.decisions.map((decision: any) => decision.machineRowSha256), packet.rules.map((rule: any) => rule.frozenMachineRowHash));

    assert.equal(reviewedUnion.size, 50);
    assert.equal(priorRuleIds.size, 40);
    assert.equal(truth.decisions.some((decision: any) => priorRuleIds.has(decision.stableRuleId)), false);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), selectionManifest.batches["5"].expectedRuleIds);

    assert.equal(truth.sourceDocument.contentSha256, packet.sourceDocument.contentSha256);
    assert.equal(truth.machineProposalRef.sha256, packet.frozenMachineProposal.sha256);
    assert.equal(truth.machineProposalRef.sha256, sha256(fs.readFileSync(frozenProposalPath)));
    assert.equal(truth.machineProposalRef.sha256, batchManifest.frozenProposalSha256);
    assert.equal(truth.sourceDocument.contentSha256, batchManifest.sourceDocumentSha256);

    for (const decision of truth.decisions) {
      const packetRule = packet.rules.find((rule: any) => rule.stableRuleId === decision.stableRuleId);
      assert.ok(packetRule, `Missing packet rule for ${decision.stableRuleId}`);
      if (batch3RuleIds.has(decision.stableRuleId) && !wave1ReassessedRuleIds.has(decision.stableRuleId)) {
        for (const [index, evidence] of [...decision.acceptedEvidence, ...decision.rejectedEvidence].entries()) {
          assertBatch3EvidenceProvenance(decision.stableRuleId, evidence, index < decision.acceptedEvidence.length ? "acceptedEvidence" : "rejectedEvidence", index < decision.acceptedEvidence.length ? index : index - decision.acceptedEvidence.length);
        }
        assertBatch3IntegratedRow(decision, decision.stableRuleId);
      } else {
        if (wave1ReassessedRuleIds.has(decision.stableRuleId)) continue;
        for (const [index, evidence] of decision.acceptedEvidence.entries()) {
          assertPacketEvidenceMembership(packetEvidencePool, decision.stableRuleId, "acceptedEvidence", index, evidence);
        }
        for (const [index, evidence] of decision.rejectedEvidence.entries()) {
          assertPacketEvidenceMembership(packetEvidencePool, decision.stableRuleId, "rejectedEvidence", index, evidence);
        }
      }
    }

    const schemaDecision = schema.$defs.decision;
    assert.ok(schemaDecision.required.includes("reviewStatus"));
    assert.ok(schemaDecision.required.includes("expertReviewRequired"));
    assert.ok(schema.$defs.evidenceReference.required.includes("documentSha256"));
    assert.ok(schema.$defs.evidenceReference.required.includes("spanId"));
  });

  it("keeps evidence semantics separate from packet membership", () => {
    const truth = read<Record<string, any>>(reviewedTruthPath);
    const decisions = new Map(truth.decisions.map((decision: any) => [decision.stableRuleId, decision]));
    const noEvidencePattern = /^No accepted evidence exists in the packet/;

    for (const decision of truth.decisions) {
      if (decision.acceptedEvidence.length === 0 && decision.finalApplicability !== "NOT_APPLICABLE") {
        assert.match(decision.assessmentReason, noEvidencePattern, `${decision.stableRuleId} assessment must explain missing accepted evidence`);
      } else {
        assert.doesNotMatch(decision.assessmentReason, noEvidencePattern, `${decision.stableRuleId} has accepted evidence but describes none`);
      }
      if (decision.finalApplicability === "NOT_APPLICABLE") {
        assert.equal(decision.gap, "", `${decision.stableRuleId} resolved N/A gap`);
        assert.equal(decision.clientAction, "", `${decision.stableRuleId} resolved N/A client action`);
      }
      const judgmentText = JSON.stringify({ ...decision, acceptedEvidence: [], rejectedEvidence: [] });
      assert.equal(judgmentText.includes("REDD+/ARR"), false, `${decision.stableRuleId} contains unsupported REDD+/ARR characterization`);
    }

    const r30008 = decisions.get("Verra.AFOLU.VM0007.v1-8.R-3-0008");
    assert.equal(r30008.reviewStatus, "REVIEWED");
    assert.equal(r30008.expertReviewRequired, false);
    assert.equal(r30008.finalApplicability, "NOT_APPLICABLE");
    assert.equal(r30008.finalEvidenceState, "N/A");
    assert.equal(r30008.reviewerOutcome, "NOT_APPLICABLE");
    assert.match(r30008.assessmentReason, /rule is permissive/i);
    assert.equal(r30008.gap, "");
    assert.equal(r30008.clientAction, "");
    assert.equal(r30008.provisionalReason, null);
    assert.equal(r30008.reviewerConfidence, "HIGH");

    for (const shortRuleId of ["R-3-0006", "R-4-0002", "R-5-0002", "R-5-0004"]) {
      const decision = truth.decisions.find((candidate: any) => candidate.stableRuleId.endsWith(`.${shortRuleId}`));
      assert.ok(decision, `Missing corrected decision ${shortRuleId}`);
      assert.equal(decision.acceptedEvidence[0].page, 84);
      assert.equal(decision.acceptedEvidence[0].spanId, "quick-check-review-question:element:paragraph:3.1.2");
      assert.match(decision.assessmentReason, /no peatlands or tidal wetlands/);
      assert.equal(decision.rejectedEvidence[0].page, 59);
      assert.equal(decision.rejectedEvidence[0].spanId, "quick-check-review-question:element:paragraph:2.3.14");
      assert.match(decision.correctionReason, /moved to rejectedEvidence/);
    }
  });
});
