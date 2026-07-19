import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, it } from "@jest/globals";
import { assertBatch3EvidenceProvenance, assertBatch3IntegratedRow, batch3RuleIds } from "./mayaBatch3ExpectedIntegration";

const root = process.cwd();
const batchDir = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/rc/rc5/rc5-2-maya-batch-4-adjudication");
const selectionManifestPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/baselines/rc5/rc5-batch-selection-manifest.json");
const reviewedTruthPath = path.join(batchDir, "reviewed-truth.json");
const reviewPacketPath = path.join(batchDir, "review-packet.json");
const reviewTemplatePath = path.join(batchDir, "review-template.json");
const reviewSchemaPath = path.join(batchDir, "review-response-schema.json");
const batchManifestPath = path.join(batchDir, "manifest.json");
const frozenProposalPath = path.join(root, "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");

const read = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
const sha256 = (value: string | Buffer): string => crypto.createHash("sha256").update(value).digest("hex");
const keyForEvidence = (evidence: {
  quote: string;
  page: number;
  sectionHeading: string;
  spanId: string;
  documentId: string;
  documentSha256: string;
}) => [
  evidence.quote,
  String(evidence.page),
  evidence.sectionHeading,
  evidence.spanId,
  evidence.documentId,
  evidence.documentSha256,
].join("\u0001");
const keyForPacketContext = (context: {
  exactQuote: string;
  pageNumber: number;
  sectionHeading: string;
  sourceSpanId: string;
  documentIdentity: { documentId: string; contentSha256: string };
}) => [
  context.exactQuote,
  String(context.pageNumber),
  context.sectionHeading,
  context.sourceSpanId,
  context.documentIdentity.documentId,
  context.documentIdentity.contentSha256,
].join("\u0001");
const authorizedTargetRuleIds = new Set([
  "Verra.AFOLU.VM0007.v1-8.R-2-0013",
  "Verra.AFOLU.VM0007.v1-8.R-2-0014",
]);

describe("RC5-2 Maya Batch 4 reviewed truth", () => {
  it("matches the canonical Batch 4 packet, schema, and frozen inputs without changing machine truth", () => {
    assert.equal(fs.existsSync(reviewedTruthPath), true);

    const truth = read<Record<string, any>>(reviewedTruthPath);
    const packet = read<Record<string, any>>(reviewPacketPath);
    const template = read<Record<string, any>>(reviewTemplatePath);
    const schema = read<Record<string, any>>(reviewSchemaPath);
    const batchManifest = read<Record<string, any>>(batchManifestPath);
    const selectionManifest = read<Record<string, any>>(selectionManifestPath);
    const selection = selectionManifest.batches["4"];
    const packetContextsByKey = new Map<string, Record<string, any>>(
      Object.values(packet.contexts).map((context: any) => [keyForPacketContext(context), context]),
    );

    const validate = new Ajv2020({ strict: false }).compile(schema);
    assert.equal(validate(truth), true, JSON.stringify(validate.errors));

    assert.equal(truth.schemaVersion, schema.$id);
    assert.equal(truth.decisions.length, 10);
    assert.equal(new Set(truth.decisions.map((decision: any) => decision.stableRuleId)).size, 10);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), selection.expectedRuleIds);
    assert.deepEqual(truth.decisions.map((decision: any) => decision.stableRuleId), packet.selectedRuleIds);
    assert.deepEqual(template.decisions.map((decision: any) => decision.stableRuleId), selection.expectedRuleIds);

    assert.equal(truth.decisions.filter((decision: any) => decision.reviewStatus === "REVIEWED").length, 8);
    assert.equal(truth.decisions.filter((decision: any) => decision.reviewStatus === "PROVISIONAL").length, 2);
    assert.equal(truth.decisions.some((decision: any) => decision.reviewStatus === "PENDING_INDEPENDENT_ADJUDICATION"), false);
    assert.equal(truth.decisions.some((decision: any) => decision.reviewStatus === "REVIEWED"), true);
    assert.equal(truth.decisions.filter((decision: any) => decision.reviewStatus === "PROVISIONAL").every((decision: any) => decision.expertReviewRequired === true), true);
    assert.equal(truth.decisions.filter((decision: any) => decision.reviewStatus === "PROVISIONAL").every((decision: any) => typeof decision.provisionalReason === "string" && decision.provisionalReason.trim().length > 0), true);
    assert.equal(truth.decisions.filter((decision: any) => decision.reviewStatus === "REVIEWED").every((decision: any) => decision.provisionalReason === null), true);

    const priorReviewedRuleIds = new Set<string>([
      ...selectionManifest.batches["1"].expectedRuleIds,
      ...selectionManifest.batches["2"].expectedRuleIds,
      ...selectionManifest.batches["3"].expectedRuleIds,
    ]);
    assert.equal(truth.decisions.some((decision: any) => priorReviewedRuleIds.has(decision.stableRuleId)), false);

    assert.equal(truth.sourceDocument.contentSha256, packet.sourceDocument.contentSha256);
    assert.equal(truth.sourceDocument.contentSha256, template.sourceDocument.contentSha256);
    assert.equal(truth.machineProposalRef.sha256, packet.frozenMachineProposal.sha256);
    assert.equal(truth.machineProposalRef.sha256, template.machineProposalRef.sha256);
    assert.equal(truth.machineProposalRef.sha256, batchManifest.frozenProposalSha256);
    assert.equal(sha256(fs.readFileSync(frozenProposalPath)), batchManifest.frozenProposalSha256);
    assert.equal(truth.machineProposalRef.sha256, sha256(fs.readFileSync(frozenProposalPath)));

    assert.deepEqual(truth.decisions.map((decision: any) => decision.machineRowSha256), packet.rules.map((rule: any) => rule.frozenMachineRowHash));
    assert.deepEqual(truth.decisions.map((decision: any) => decision.machineRowSha256), template.decisions.map((decision: any) => decision.machineRowSha256));
    assert.deepEqual(Object.keys(batchManifest.machineRowSha256), selection.expectedRuleIds);
    assert.deepEqual(batchManifest.selectedRuleIds, selection.expectedRuleIds);
    assert.equal(batchManifest.reviewedRuleIds.length, 30);

    for (const [index, decision] of truth.decisions.entries()) {
      const packetRule = packet.rules.find((rule: any) => rule.stableRuleId === decision.stableRuleId);
      assert.ok(packetRule, `Missing packet rule for ${decision.stableRuleId}`);
      assert.equal(decision.machineRowSha256, packetRule.frozenMachineRowHash);
      assert.equal(packetRule.frozenMachineRowHash, batchManifest.machineRowSha256[decision.stableRuleId]);

      const compareEvidenceSet = (
        truthEvidence: Array<Record<string, any>>,
        label: "accepted" | "rejected",
      ) => {
        assert.equal(truthEvidence.length > 0, true, `${decision.stableRuleId} ${label} evidence must not be empty in reviewed truth`);
        truthEvidence.forEach((evidence, evidenceIndex) => {
          const packetContext = packetContextsByKey.get(keyForEvidence(evidence));
          assert.ok(packetContext, `${decision.stableRuleId} missing ${label} packet context ${evidenceIndex}`);
          assert.equal(keyForEvidence(evidence), keyForPacketContext(packetContext), `${decision.stableRuleId} ${label} evidence provenance mismatch`);
          assert.equal(evidence.quote, packetContext.exactQuote, `${decision.stableRuleId} ${label} quote mismatch`);
          assert.equal(evidence.page, packetContext.pageNumber, `${decision.stableRuleId} ${label} page mismatch`);
          assert.equal(evidence.sectionHeading, packetContext.sectionHeading, `${decision.stableRuleId} ${label} sectionHeading mismatch`);
          assert.equal(evidence.spanId, packetContext.sourceSpanId, `${decision.stableRuleId} ${label} spanId mismatch`);
          assert.equal(evidence.documentId, packetContext.documentIdentity.documentId, `${decision.stableRuleId} ${label} documentId mismatch`);
          assert.equal(evidence.documentSha256, packetContext.documentIdentity.contentSha256, `${decision.stableRuleId} ${label} documentSha256 mismatch`);
        });
      };

      if (batch3RuleIds.has(decision.stableRuleId)) {
        assertBatch3IntegratedRow(decision, decision.stableRuleId);
        for (const [kind, evidence] of [["acceptedEvidence", decision.acceptedEvidence], ["rejectedEvidence", decision.rejectedEvidence]] as const) {
          evidence.forEach((item: Record<string, any>, evidenceIndex: number) => assertBatch3EvidenceProvenance(decision.stableRuleId, item, kind, evidenceIndex));
        }
      } else if (decision.reviewStatus === "PROVISIONAL" && !authorizedTargetRuleIds.has(decision.stableRuleId)) {
        compareEvidenceSet(decision.acceptedEvidence, "accepted");
        compareEvidenceSet(decision.rejectedEvidence, "rejected");
        for (const evidence of [...decision.acceptedEvidence, ...decision.rejectedEvidence]) {
          assert.equal(packetContextsByKey.has(keyForEvidence(evidence)), true, `${decision.stableRuleId} evidence missing from packet`);
        }
      }

      if (decision.stableRuleId === "Verra.AFOLU.VM0007.v1-8.R-3-0002") {
        assert.equal(decision.genericFailureCategory, "ASSESSMENT");
      }

      assert.equal(typeof decision.assessmentReason, "string");
      assert.equal(typeof decision.reviewerConfidence, "string");
      assert.equal(typeof decision.finalEvidenceState, "string");
      assert.equal(typeof decision.finalApplicability, "string");
      assert.equal(typeof decision.reviewerOutcome, "string");
      assert.equal(typeof decision.contradictionState, "string");

      const status = decision.reviewStatus;
      assert.ok(status === "PROVISIONAL" || status === "REVIEWED", `Unexpected reviewStatus for ${decision.stableRuleId} at index ${index}`);
      if (status === "PROVISIONAL") assert.equal(decision.provisionalReason.trim().length > 0, true);
    }

    const statusCounts = truth.decisions.reduce((counts: Record<string, number>, decision: Record<string, any>) => {
      counts[decision.reviewStatus] = (counts[decision.reviewStatus] ?? 0) + 1;
      return counts;
    }, {});
    const finalEvidenceStateCounts = truth.decisions.reduce((counts: Record<string, number>, decision: Record<string, any>) => {
      counts[decision.finalEvidenceState] = (counts[decision.finalEvidenceState] ?? 0) + 1;
      return counts;
    }, {});
    const genericFailureCategoryCounts = truth.decisions.reduce((counts: Record<string, number>, decision: Record<string, any>) => {
      counts[decision.genericFailureCategory] = (counts[decision.genericFailureCategory] ?? 0) + 1;
      return counts;
    }, {});

    assert.deepEqual(statusCounts, { REVIEWED: 8, PROVISIONAL: 2 });
    assert.deepEqual(finalEvidenceStateCounts, { "N/A": 6, UNCLEAR: 2, FOUND: 2 });
    assert.deepEqual(genericFailureCategoryCounts, { ASSESSMENT: 7, COMPONENT_COVERAGE: 2, NONE: 1 });
  });
});
