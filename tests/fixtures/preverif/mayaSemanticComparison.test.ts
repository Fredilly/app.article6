import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "@jest/globals";

const canonicalPath = path.join(process.cwd(), "tests/fixtures/preverif/maya-forest-corridor-redd-belize/machine-proposal.json");
const frozenPath = path.join(process.cwd(), "tests/fixtures/preverif/maya-forest-corridor-redd-belize-live/machine-proposal.json");
const comparisonPath = path.join(process.cwd(), "docs/roadmaps/interactive-evidence-review-mvp/rc5/rc5-2-live-maya/semantic-comparison.json");

const ignoredIdentityFields = new Set(["auditId", "generatedAt", "runId", "rowId", "proposalTimestamp"]);
const envelopeDefaults: Record<string, unknown> = {
  mapVersion: 1,
  finalizationState: "draft",
  finalizedBy: null,
  finalizedAt: null,
  finalizationBasis: null,
};

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function semanticValue(value: unknown, key?: string): unknown {
  if (key && ignoredIdentityFields.has(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => semanticValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([entryKey, entryValue]) => {
      if (ignoredIdentityFields.has(entryKey)) return [];
      return [[entryKey, semanticValue(entryValue, entryKey)]];
    }));
  }
  return value;
}

function rowHash(row: Record<string, unknown>): string {
  return sha256(JSON.stringify(row));
}

function countByEvidenceStatus(rows: Record<string, unknown>[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const status = String(row.proposedEvidenceStatus);
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

describe("RC5-2 Maya canonical semantic parity", () => {
  it("matches all 58 substantive rows and the frozen 0/44/14 counts", () => {
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8")) as { rows: Record<string, unknown>[]; [key: string]: unknown };
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8")) as { rows: Record<string, unknown>[]; [key: string]: unknown };
    const comparison = JSON.parse(fs.readFileSync(comparisonPath, "utf8"));

    for (const proposal of [canonical, frozen]) {
      assert.equal(proposal.rows.length, 58);
      const counts = countByEvidenceStatus(proposal.rows);
      assert.equal(counts.FOUND ?? 0, 0);
      assert.equal(counts.UNCLEAR ?? 0, 44);
      assert.equal(counts.MISSING ?? 0, 14);
    }

    const canonicalByRule = new Map(canonical.rows.map((row) => [row.stableRuleId, row]));
    const frozenByRule = new Map(frozen.rows.map((row) => [row.stableRuleId, row]));
    assert.equal(canonicalByRule.size, 58);
    assert.deepEqual([...canonicalByRule.keys()], [...frozenByRule.keys()]);
    for (const [stableRuleId, canonicalRow] of canonicalByRule) {
      assert.deepEqual(semanticValue(canonicalRow), semanticValue(frozenByRule.get(stableRuleId)));
    }

    assert.deepEqual(comparison.aggregate, {
      matchedRuleCount: 58,
      changedRuleCount: 0,
      unchangedRuleCount: 58,
      fieldChangeCounts: {},
    });
    assert.deepEqual(comparison.ignoredRunIdentityFields, [...ignoredIdentityFields]);
    assert.deepEqual(comparison.envelopeDefaults, envelopeDefaults);
  });

  it("detects substantive row changes but tolerates approved identity changes", () => {
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8")) as { rows: Record<string, unknown>[] };
    const original = frozen.rows[0];
    const identityOnly = { ...original, rowId: "different-run:row", proposalTimestamp: "2099-01-01T00:00:00.000Z" };
    assert.deepEqual(semanticValue(original), semanticValue(identityOnly));
    assert.notEqual(rowHash(original), rowHash(identityOnly));

    const substantiveChange = { ...original, clientAction: `${String(original.clientAction)} changed` };
    assert.notDeepEqual(semanticValue(original), semanticValue(substantiveChange));
    assert.notEqual(rowHash(original), rowHash(substantiveChange));
  });

  it("contains no reviewed truth or reviewer-outcome proposal", () => {
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8")) as { rows: Record<string, unknown>[]; [key: string]: unknown };
    assert.equal(frozen.proposalState, "MACHINE_PROPOSED");
    assert.equal("outcomeCounts" in frozen, false);
    assert.equal("reviewedTruth" in frozen, false);
    assert.ok(frozen.rows.every((row) => row.finalizationState === "draft"));
    assert.ok(frozen.rows.every((row) => !["CONFORMS", "ACTION_REQUIRED"].includes(String(row.outcome))));
  });
});
