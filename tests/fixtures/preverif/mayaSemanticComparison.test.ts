import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";

const baselinePath = path.join(process.cwd(), "tests/fixtures/preverif/maya-forest-corridor-redd-belize/machine-proposal.json");
const livePath = path.join(process.cwd(), "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const comparisonPath = path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/semantic-comparison.json");

const expectedFields = [
  "ruleReference", "ruleTitle", "requirementText", "methodologyId", "methodologyVersion",
  "rawAuditStatus", "upstreamStatus", "proposedEvidenceStatus", "proposedApplicability",
  "proposedAcceptedEvidence", "proposedRejectedEvidence", "acceptedEvidence", "rejectedEvidence",
  "supportedComponents", "missingComponents", "reasonSelected", "assessmentReason", "gap", "clientAction",
  "confidence", "searchCoverage", "sourceDocument", "quote", "page", "section", "spanId", "provenance",
  "finalizationState", "reviewState", "reviewHistory", "rowVersion", "finalizationActorRef", "finalizedAt",
  "finalizationBasis", "reviewHistoryRef", "proposalSource",
];

function sha256(bytes: Buffer): string { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function serialized(value: unknown): string { return JSON.stringify(value); }
function valueOrNull(row: Record<string, unknown>, field: string): unknown { return row[field] === undefined ? null : row[field]; }

describe("RC5-2 Maya semantic comparison", () => {
  it("documents every changed rule and field, with matching aggregates", () => {
    const baselineBytes = fs.readFileSync(baselinePath);
    const liveBytes = fs.readFileSync(livePath);
    const baseline = JSON.parse(baselineBytes.toString()) as { rows: Record<string, unknown>[] };
    const live = JSON.parse(liveBytes.toString()) as { rows: Record<string, unknown>[] };
    const comparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));

    assert.equal(sha256(baselineBytes), "f1c04bfc2d4e4ed3504e4c48c5e946d26685e3818763a64e2751b4f12ea59844");
    assert.equal(sha256(liveBytes), "e996de2eef1fc80aefa94e723903049ae4451fb161baccf337750694a394479b");
    assert.deepEqual(comparison.comparisonFields, expectedFields);
    assert.equal(baseline.rows.length, 58);
    assert.equal(live.rows.length, 58);

    const baselineById = new Map(baseline.rows.map((row) => [row.stableRuleId, row]));
    const liveById = new Map(live.rows.map((row) => [row.stableRuleId, row]));
    const expectedRules: Array<Record<string, unknown>> = [];
    const fieldCounts: Record<string, number> = {};
    const transitions: Array<{ stableRuleId: string; before: string; after: string }> = [];

    for (const [stableRuleId, before] of baselineById) {
      const after = liveById.get(stableRuleId);
      assert.ok(after, `live row missing for ${String(stableRuleId)}`);
      const changes: Record<string, { before: unknown; after: unknown }> = {};
      for (const field of expectedFields) {
        const beforeValue = valueOrNull(before, field);
        const afterValue = valueOrNull(after!, field);
        if (serialized(beforeValue) !== serialized(afterValue)) {
          changes[field] = { before: beforeValue, after: afterValue };
          fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
        }
      }
      const beforeRanking = baseline.rows.indexOf(before);
      const afterRanking = live.rows.indexOf(after!);
      if (beforeRanking !== afterRanking) {
        changes.ranking = { before: beforeRanking, after: afterRanking };
        fieldCounts.ranking = (fieldCounts.ranking ?? 0) + 1;
      }
      if (Object.keys(changes).length > 0) {
        expectedRules.push({ stableRuleId, baselineEvidenceState: before.proposedEvidenceStatus, liveEvidenceState: after!.proposedEvidenceStatus, changedFields: Object.keys(changes), changes });
        if (before.proposedEvidenceStatus !== after!.proposedEvidenceStatus) transitions.push({ stableRuleId, before: String(before.proposedEvidenceStatus), after: String(after!.proposedEvidenceStatus) });
      }
    }

    assert.deepEqual(comparison.rules, expectedRules);
    assert.equal(comparison.aggregate.matchedRuleCount, 58);
    assert.equal(comparison.aggregate.changedRuleCount, expectedRules.length);
    assert.equal(comparison.aggregate.unchangedRuleCount, 58 - expectedRules.length);
    assert.deepEqual(comparison.aggregate.fieldChangeCounts, fieldCounts);
    assert.deepEqual(comparison.statusTransitions, transitions);

    const transitionCounts: Record<string, number> = {};
    for (const transition of transitions) {
      const key = `${transition.before}->${transition.after}`;
      transitionCounts[key] = (transitionCounts[key] ?? 0) + 1;
    }
    assert.deepEqual(comparison.aggregate.statusTransitionCounts, transitionCounts);
  });
});
