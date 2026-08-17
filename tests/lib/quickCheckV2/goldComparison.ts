import {
  normalizeEvidenceStack,
  type EvidenceStackItem,
} from "@/lib/evidence/evidenceStack";
import type { StatusResult } from "@/lib/quickCheckV2/status";
import type { StructuredCheckId } from "@/lib/quickCheckV2/evidence";

export type QuickCheckGoldComparableRecord = {
  checkName: StructuredCheckId;
  expectedStatus: "FOUND" | "UNCLEAR" | "MISSING";
  expectedAnswer: string | null;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string | null;
  sourceType: "fact_contract" | "exact_section" | "raw_text_fallback" | null;
  evidenceStack?: EvidenceStackItem[];
};

function normalizeComparableAnswer(answer: string | null): string | null {
  return answer?.replace(/\.$/, "") ?? null;
}

export function buildComparableQuickCheckRecord(
  result: Pick<StatusResult, "checkName" | "status" | "answer" | "evidence" | "evidenceStack">,
  expected: Pick<QuickCheckGoldComparableRecord, "evidenceStack">,
): QuickCheckGoldComparableRecord {
  const record: QuickCheckGoldComparableRecord = {
    checkName: result.checkName,
    expectedStatus: result.status,
    expectedAnswer: normalizeComparableAnswer(result.answer),
    goldQuote: result.evidence?.quote ?? null,
    page: result.evidence?.page ?? null,
    sectionHeading: result.evidence?.sectionHeading ?? null,
    sectionPath: result.evidence?.sectionPath ?? [],
    spanId: result.evidence?.spanId ?? null,
    sourceType: result.evidence?.sourceType ?? null,
  };

  if (expected.evidenceStack) {
    record.evidenceStack = normalizeEvidenceStack(result.evidenceStack ?? []);
  }

  return record;
}

export function normalizeExpectedQuickCheckGoldRecord(
  record: QuickCheckGoldComparableRecord,
): QuickCheckGoldComparableRecord {
  const normalizedRecord = {
    ...record,
    expectedAnswer: normalizeComparableAnswer(record.expectedAnswer),
  };
  if (!record.evidenceStack) {
    return normalizedRecord;
  }

  return {
    ...normalizedRecord,
    evidenceStack: normalizeEvidenceStack(record.evidenceStack),
  };
}
