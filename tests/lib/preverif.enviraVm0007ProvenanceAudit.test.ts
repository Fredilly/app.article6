import fs from "node:fs";
import { describe, expect, test } from "@jest/globals";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import type { FixtureStatus, FullAuditFixtureSet, SourceExcerpts } from "./preverifJudgmentFixtureGate";
import type { Vm0007EvidenceMapRow } from "@/lib/preverif/fixtureBackedVm0007Report";

const FULL_AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-full-audit-fixture-shape.json", "utf8"),
) as FullAuditFixtureSet;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

type AuditCheckStatus =
  | "OK"
  | "QUOTE_PAGE_MISMATCH"
  | "SECTION_MISMATCH"
  | "MISSING_SOURCE_EXCERPT"
  | "NEEDS_MANUAL_REVIEW"
  | "NO_ACCEPTED_QUOTE_EXPECTED";

type AuditRowResult = {
  ruleId: string;
  fixtureStatus: FixtureStatus;
  auditStatus: "OK" | "QUOTE_PAGE_MISMATCH" | "SECTION_MISMATCH" | "MISSING_SOURCE_EXCERPT" | "NEEDS_MANUAL_REVIEW";
  quotePresent: boolean;
  page: number | null;
  quotePageCheck: AuditCheckStatus;
  sectionCheck: AuditCheckStatus;
  notes: string[];
};

const MANUAL_REVIEW_ROW_IDS = new Set([
  "R-2-0002",
  "R-2-0012",
  "R-3-0003",
  "R-3-0004",
  "R-6-0004",
  "R-6-0007",
]);

function normalizeMatchText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getPageExcerpt(page: number | null | undefined): string | null {
  if (page == null) return null;
  return SOURCE_EXCERPTS.pageExcerpts[String(page)]?.trim() ?? null;
}

function findConservativeQuoteChunk(normalizedQuote: string, normalizedPage: string): string | null {
  const tokens = normalizedQuote.split(" ").filter(Boolean);
  const windowSizes = [12, 10, 8, 6];

  for (const windowSize of windowSizes) {
    if (tokens.length < windowSize) continue;
    for (let index = 0; index <= tokens.length - windowSize; index += 1) {
      const chunk = tokens.slice(index, index + windowSize).join(" ");
      if (normalizedPage.includes(chunk)) {
        return chunk;
      }
    }
  }

  return null;
}

function assessQuoteAnchoring(row: Vm0007EvidenceMapRow, pageExcerpt: string | null): { status: AuditCheckStatus; note?: string } {
  const quote = row.acceptedQuote?.trim();
  if (!quote) {
    return {
      status: row.status === "FOUND" || row.status === "UNCLEAR" ? "NEEDS_MANUAL_REVIEW" : "NO_ACCEPTED_QUOTE_EXPECTED",
    };
  }

  if (!row.page) {
    return { status: "NEEDS_MANUAL_REVIEW", note: "accepted quote exists but the row has no cited page" };
  }

  if (!pageExcerpt) {
    return { status: "MISSING_SOURCE_EXCERPT", note: `no source excerpt is available for page ${row.page}` };
  }

  const normalizedQuote = normalizeMatchText(quote);
  const normalizedPage = normalizeMatchText(pageExcerpt);

  if (normalizedPage.includes(normalizedQuote)) {
    return { status: "OK" };
  }

  const conservativeChunk = findConservativeQuoteChunk(normalizedQuote, normalizedPage);
  if (conservativeChunk) {
    return {
      status: "NEEDS_MANUAL_REVIEW",
      note: `only a conservative chunk matched on page ${row.page}: "${conservativeChunk}"`,
    };
  }

  return { status: "QUOTE_PAGE_MISMATCH", note: `quote was not found on page ${row.page}` };
}

function assessSectionAnchoring(row: Vm0007EvidenceMapRow, pageExcerpt: string | null, sectionHeadingPage: number | null | undefined): { status: AuditCheckStatus; note?: string } {
  const sectionHeading = row.sectionHeading?.trim();
  if (!sectionHeading) {
    return { status: "NO_ACCEPTED_QUOTE_EXPECTED" };
  }

  const candidatePages = new Set<number>();
  if (sectionHeadingPage != null) candidatePages.add(sectionHeadingPage);
  if (row.page != null) candidatePages.add(row.page);
  if (row.page != null && row.page > 1) candidatePages.add(row.page - 1);

  if (!pageExcerpt && candidatePages.size === 0) {
    return { status: "MISSING_SOURCE_EXCERPT", note: "no source excerpt is available for the cited section" };
  }

  const normalizedHeading = normalizeMatchText(sectionHeading);
  for (const candidatePage of candidatePages) {
    const excerpt = getPageExcerpt(candidatePage);
    if (!excerpt) continue;
    if (normalizeMatchText(excerpt).includes(normalizedHeading)) {
      return { status: "OK" };
    }
  }

  const pageLabel = sectionHeadingPage ?? row.page;
  if (pageLabel == null) {
    return { status: "NEEDS_MANUAL_REVIEW", note: "section heading exists but the row has no page anchor" };
  }

  if (!getPageExcerpt(pageLabel)) {
    return { status: "MISSING_SOURCE_EXCERPT", note: `no source excerpt is available for page ${pageLabel}` };
  }

  return { status: "SECTION_MISMATCH", note: `section heading was not found on page ${pageLabel}` };
}

function formatAuditTable(rows: AuditRowResult[]): string {
  const header = "Rule ID | Status | Quote present | Page | Quote-page check | Section check | Notes";
  const lines = rows.map((row) => {
    const notes = row.notes.length > 0 ? row.notes.join(" ; ") : "";
    return [
      row.ruleId,
      row.auditStatus,
      row.quotePresent ? "yes" : "no",
      row.page == null ? "" : String(row.page),
      row.quotePageCheck,
      row.sectionCheck,
      notes,
    ].join(" | ");
  });
  return [header, ...lines].join("\n");
}

describe("Envira VM0007 provenance audit", () => {
  test("checks the quarantined legacy mismatch report rows against the fixture-backed source excerpts", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const fullAuditChecksById = new Map(FULL_AUDIT_FIXTURE.checks.map((check) => [check.checkId, check]));
    const auditRows: AuditRowResult[] = [];

    expect(report.evidenceMapRows).toHaveLength(58);
    expect(report.summary.totalRules).toBe(58);
    expect(report.summary.counts).toEqual({
      FOUND: 30,
      UNCLEAR: 8,
      MISSING: 3,
      "N/A": 17,
    });
    expect(report.quarantine).toEqual({
      label: "Legacy v1.5 mismatch regression fixture",
      status: "quarantined",
      versionMatch: false,
      pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
      loadedRulebookVersion: "VM0007 v1.8",
      note: "Historical counts are contaminated legacy output and must not be treated as validated truth.",
    });

    for (const row of report.evidenceMapRows) {
      const fixtureCheck = fullAuditChecksById.get(row.ruleId);
      expect(fixtureCheck).toBeTruthy();

      if (
        row.status === "UNCLEAR" &&
        !row.acceptedQuote?.trim() &&
        row.page == null &&
        row.sectionHeading == null &&
        MANUAL_REVIEW_ROW_IDS.has(row.ruleId)
      ) {
        auditRows.push({
          ruleId: row.ruleId,
          fixtureStatus: row.status,
          auditStatus: "NEEDS_MANUAL_REVIEW",
          quotePresent: false,
          page: row.page,
          quotePageCheck: "NO_ACCEPTED_QUOTE_EXPECTED",
          sectionCheck: "NO_ACCEPTED_QUOTE_EXPECTED",
          notes: [fixtureCheck?.reason ?? "manual review required"],
        });
        continue;
      }

      const pageExcerpt = getPageExcerpt(row.page);
      const quoteCheck = assessQuoteAnchoring(row, pageExcerpt);
      const sectionCheck = assessSectionAnchoring(row, pageExcerpt, fixtureCheck?.sectionHeadingPage);

      const issues: string[] = [];

      if (row.status === "MISSING") {
        if (row.acceptedQuote != null || row.page != null || row.sectionHeading != null) {
          issues.push("missing rows must not carry provenance fields");
        }
      }

      if (row.status === "FOUND" || row.status === "UNCLEAR") {
        if (!row.acceptedQuote?.trim()) {
          issues.push("expected a quote for this evidence-bearing row");
        }
        if (row.page == null) {
          issues.push("expected a page for this evidence-bearing row");
        }
      }

      if (quoteCheck.status !== "OK" && quoteCheck.status !== "NO_ACCEPTED_QUOTE_EXPECTED") {
        issues.push(quoteCheck.note ?? quoteCheck.status);
      }

      if (sectionCheck.status !== "OK" && sectionCheck.status !== "NO_ACCEPTED_QUOTE_EXPECTED") {
        issues.push(sectionCheck.note ?? sectionCheck.status);
      }

      auditRows.push({
        ruleId: row.ruleId,
        fixtureStatus: row.status,
        auditStatus:
          issues.length === 0
            ? "OK"
            : quoteCheck.status === "QUOTE_PAGE_MISMATCH"
              ? "QUOTE_PAGE_MISMATCH"
              : sectionCheck.status === "SECTION_MISMATCH"
                ? "SECTION_MISMATCH"
                : quoteCheck.status === "MISSING_SOURCE_EXCERPT" || sectionCheck.status === "MISSING_SOURCE_EXCERPT"
                  ? "MISSING_SOURCE_EXCERPT"
                  : "NEEDS_MANUAL_REVIEW",
        quotePresent: Boolean(row.acceptedQuote?.trim()),
        page: row.page,
        quotePageCheck: quoteCheck.status,
        sectionCheck: sectionCheck.status,
        notes: issues,
      });
    }

    const manualReviewRows = auditRows.filter((row) => row.auditStatus === "NEEDS_MANUAL_REVIEW");
    const problematicRows = auditRows.filter((row) => row.notes.length > 0 && row.auditStatus !== "NEEDS_MANUAL_REVIEW");

    if (manualReviewRows.length > 0) {
      // Keep the manual-review surface visible without failing the audit on known weak rows.
      // eslint-disable-next-line no-console
      console.warn(`Envira VM0007 provenance audit manual-review rows:\n${formatAuditTable(manualReviewRows)}`);
    }

    if (problematicRows.length > 0) {
      throw new Error(`Envira VM0007 provenance audit found issues:\n${formatAuditTable(problematicRows)}`);
    }
  });
});
