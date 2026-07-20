import assert from "node:assert/strict";
import fs from "node:fs";
import { buildExpectedIntegration, packetPath, selectedRuleIds, truthFiles } from "../../../scripts/preverif/generate-rc5-maya-independent-review-batch3-integration";
import { buildExpected as buildFinalSixExpected, ids as finalSixIds } from "../../../scripts/preverif/integrate-rc5-maya-final-six";

type Json = Record<string, any>;

const root = process.cwd();
const evidenceKey = (evidence: Json) => JSON.stringify([
  evidence.quote,
  evidence.page,
  evidence.sectionHeading ?? evidence.heading,
  evidence.spanId,
  evidence.documentId,
  evidence.documentSha256,
]);

let cached: { rows: Map<string, Json>; candidates: Map<string, Set<string>> } | undefined;

function load() {
  if (cached) return cached;
  const expected = buildExpectedIntegration();
  const rows = new Map<string, Json>();
  for (const file of truthFiles) {
    for (const row of expected.integrated.get(file)!.decisions as Json[]) {
      if ((selectedRuleIds as readonly string[]).includes(row.stableRuleId)) rows.set(row.stableRuleId, row);
    }
  }
  const finalSix = buildFinalSixExpected();
  const finalSixRows = new Map(finalSix.out.flatMap((doc: Json) => doc.decisions as Json[]).filter((row) => finalSixIds.includes(row.stableRuleId)).map((row) => [row.stableRuleId, row]));
  for (const [id, row] of finalSixRows) rows.set(id, row);
  const packet = JSON.parse(fs.readFileSync(packetPath, "utf8")) as Json;
  const candidates = new Map<string, Set<string>>(
    (packet.rules as Json[]).map((rule) => [rule.stableRuleId, new Set((rule.candidateEvidence as Json[]).map(evidenceKey))]),
  );
  cached = { rows, candidates };
  return cached;
}

export const batch3RuleIds = new Set<string>(selectedRuleIds);

export function assertBatch3IntegratedRow(actual: Json, stableRuleId: string) {
  const expected = load().rows.get(stableRuleId);
  assert.ok(expected, `Missing expected Batch 3 integrated row ${stableRuleId}`);
  assert.deepEqual(actual, expected, `${stableRuleId} differs from the authorized Batch 3 integrated row`);
}

export function assertBatch3EvidenceProvenance(stableRuleId: string, evidence: Json, field: string, index: number) {
  const candidates = load().candidates.get(stableRuleId);
  assert.ok(candidates, `Missing Batch 3 packet rule ${stableRuleId}`);
  assert.ok(candidates.has(evidenceKey(evidence)), `${stableRuleId} ${field}[${index}] has no exact Batch 3 packet candidate`);
}

export function readCurrentBatch3Row(stableRuleId: string) {
  const expected = load().rows.get(stableRuleId);
  assert.ok(expected, `Missing expected Batch 3 integrated row ${stableRuleId}`);
  return expected;
}
