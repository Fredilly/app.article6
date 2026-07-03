import { expect } from "@jest/globals";
import type { Vm0007GapReport } from "@/lib/preverif/vm0007GapReport";

/**
 * Client-readiness gate for VM0007 gap reports.
 *
 * Enforces:
 * 1. Reports with UNCLEAR ("weak") evidence cannot be marked client-ready.
 * 2. Reports with MISSING evidence cannot be marked client-ready.
 * 3. Internal preview labels must be visibly present.
 * 4. Banned global wording ("all clear", "fully verified", "ready for verification") is rejected.
 * 5. Client-readiness stays separate from production audit logic and report UI.
 */

export const BANNED_CLIENT_READY_PHRASES = [
  "all clear",
  "fully verified",
  "ready for verification",
] as const;

export const INTERNAL_PREVIEW_LABELS = [
  "internal preview",
  "internal vm0007 gap report preview",
] as const;

export type ClientReadinessGateInput = {
  reportHtml: string;
  report: Vm0007GapReport;
};

export function assertNoUnclearEvidence(report: Vm0007GapReport): void {
  const unclearCount = report.fullRuleAuditTable.filter(
    (row) => row.status === "weak",
  ).length;
  expect(unclearCount).toBe(0);
}

export function assertNoMissingEvidence(report: Vm0007GapReport): void {
  const missingCount = report.fullRuleAuditTable.filter(
    (row) => row.status === "missing",
  ).length;
  expect(missingCount).toBe(0);
}

export function assertInternalPreviewLabelVisible(reportHtml: string): void {
  const text = reportHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const hasLabel = INTERNAL_PREVIEW_LABELS.some((label) =>
    text.includes(label),
  );
  expect(hasLabel).toBe(true);
}

export function assertNoBannedClientReadyWording(
  reportHtml: string,
  report: Vm0007GapReport,
): void {
  const combinedText = `${reportHtml} ${JSON.stringify(report)}`
    .toLowerCase()
    .replace(/\s+/g, " ");
  for (const phrase of BANNED_CLIENT_READY_PHRASES) {
    expect(combinedText).not.toContain(phrase);
  }
}

export function assertUsesStandardReportShape(
  report: Vm0007GapReport,
): void {
  expect(report.reportName).toBe("Internal VM0007 Gap Report Preview");
  for (const row of report.fullRuleAuditTable) {
    expect(["supported", "weak", "missing", "not applicable"]).toContain(
      row.status,
    );
  }
  expect(report.limitationBanner).toContain("Internal preview only");
}

export function assertClientReadinessGate(input: ClientReadinessGateInput): void {
  const { reportHtml, report } = input;

  assertUsesStandardReportShape(report);
  assertNoUnclearEvidence(report);
  assertNoMissingEvidence(report);
  assertInternalPreviewLabelVisible(reportHtml);
  assertNoBannedClientReadyWording(reportHtml, report);
}

export function assertInternalPreviewBoundaries(text: string): void {
  const normalized = text.toLowerCase();

  expect(normalized).toContain("internal preview only");
  expect(normalized).toContain("not client-ready");

  for (const banned of [
    "all clear",
    "fully verified",
    "ready for verification",
    "58 supported",
    "all rules supported",
    "passed",
  ]) {
    expect(normalized).not.toContain(banned);
  }
}
