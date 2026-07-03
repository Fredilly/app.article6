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
  /** The rendered HTML of the gap report. */
  reportHtml: string;
  /** The Vm0007GapReport object (used for data checks and banned-wording scan). */
  report: Vm0007GapReport;
};

/**
 * Asserts that the report has no UNCLEAR ("weak") rows.
 * Throws if any weak rows are present.
 */
export function assertNoUnclearEvidence(report: Vm0007GapReport): void {
  const unclearCount = report.fullRuleAuditTable.filter(
    (row) => row.status === "weak",
  ).length;
  expect(unclearCount).toBe(0);
}

/**
 * Asserts that the report has no MISSING rows.
 * Throws if any missing rows are present.
 */
export function assertNoMissingEvidence(report: Vm0007GapReport): void {
  const missingCount = report.fullRuleAuditTable.filter(
    (row) => row.status === "missing",
  ).length;
  expect(missingCount).toBe(0);
}

/**
 * Asserts that the report HTML contains an internal preview label.
 */
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

/**
 * Asserts that neither the rendered HTML nor the report data
 * contain any banned client-ready phrasing.
 */
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

/**
 * Asserts that the report uses only standard VM0007 display statuses
 * and carries an internal preview name and limitation banner.
 * This guard prevents the gate from being bypassed by type changes.
 */
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

/**
 * Full client-readiness gate assertion.
 *
 * Runs all checks and throws on the first failure.
 * Use this for convenience when you want all enforcement in one call.
 */
export function assertClientReadinessGate(input: ClientReadinessGateInput): void {
  const { reportHtml, report } = input;

  assertUsesStandardReportShape(report);
  assertNoUnclearEvidence(report);
  assertNoMissingEvidence(report);
  assertInternalPreviewLabelVisible(reportHtml);
  assertNoBannedClientReadyWording(reportHtml, report);
}
