import { CoverageRecordSchema, type CoverageRecord } from "@/lib/coverage/schema";

export type CoverageValidationResult = {
  records: CoverageRecord[];
  errors: string[];
};

const STATUS_RANK: Record<CoverageRecord["status"], number> = {
  covered: 3,
  weak: 2,
  uncovered: 1,
};

function compareRecords(a: CoverageRecord, b: CoverageRecord): number {
  if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
  const rankA = STATUS_RANK[a.status] ?? 0;
  const rankB = STATUS_RANK[b.status] ?? 0;
  if (rankA !== rankB) return rankB - rankA;
  const updatedA = a.updated_at ?? "";
  const updatedB = b.updated_at ?? "";
  return updatedB.localeCompare(updatedA);
}

export function coalesceCoverageRecords(records: CoverageRecord[]): CoverageRecord[] {
  const ordered = [...records].sort(compareRecords);
  const byRule = new Map<string, CoverageRecord>();
  for (const record of ordered) {
    if (!byRule.has(record.ruleId)) byRule.set(record.ruleId, record);
  }
  return Array.from(byRule.values()).sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export function validateCoverageRecords(input: unknown[], ruleIndex: Set<string>): CoverageValidationResult {
  const errors: string[] = [];
  const parsed: CoverageRecord[] = [];

  input.forEach((record, idx) => {
    const result = CoverageRecordSchema.safeParse(record);
    if (!result.success) {
      errors.push(`record[${idx}]: invalid shape`);
      return;
    }
    if (!ruleIndex.has(result.data.ruleId)) {
      errors.push(`record[${idx}]: unknown ruleId ${result.data.ruleId}`);
      return;
    }
    parsed.push(result.data);
  });

  const records = coalesceCoverageRecords(parsed);
  return { records, errors };
}
