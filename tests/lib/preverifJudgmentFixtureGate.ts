import { expect } from "@jest/globals";

export type FixtureStatus = "FOUND" | "UNCLEAR" | "MISSING" | "N/A";

export type RejectedQuote = {
  quote: string;
  rejectionReason: string;
};

export type JudgmentFixture = {
  checkId: string;
  checkName: string;
  expectedStatus: FixtureStatus;
  expectedAnswer: string;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  sectionHeadingPage?: number | null;
  spanId: string | null;
  whyQuoteIsSufficientOrInsufficient: string;
  knownBadQuotesToReject: RejectedQuote[];
  expectedClientAction: string | null;
  coverageTags: string[];
};

export type JudgmentFixtureSet = {
  fixtureSetId: string;
  title: string;
  inputPdfName: string;
  inputPdfPath: string;
  sourcePdfTitle: string;
  documentFamily: string;
  methodology: string;
  fixtureTruthPolicy: string;
  expectedWarnings: string[];
  checks: JudgmentFixture[];
};

export type SourceExcerpts = {
  inputPdfName: string;
  inputPdfPath: string;
  sourcePdfTitle: string;
  documentFamily: string;
  sourceTypeConfirmation: {
    page: number;
    sectionHeading: string;
    quote: string;
  };
  pageExcerpts: Record<string, string>;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function requireNonEmpty(value: string | null | undefined, label: string): void {
  expect(value?.trim().length ?? 0).toBeGreaterThan(0);
}

function assertQuoteAnchored(check: JudgmentFixture, quoteExcerpt: string, headingExcerpt: string): void {
  requireNonEmpty(check.goldQuote, `${check.checkId} goldQuote`);
  requireNonEmpty(check.sectionHeading, `${check.checkId} sectionHeading`);
  expect(normalizeText(headingExcerpt)).toContain(normalizeText(check.sectionHeading));
  expect(normalizeText(quoteExcerpt)).toContain(normalizeText(check.goldQuote));
}

export function assertVm0007JudgmentFixtureSet(
  fixtureSet: JudgmentFixtureSet,
  sourceExcerpts: SourceExcerpts,
): void {
  expect(sourceExcerpts.inputPdfName).toBe(fixtureSet.inputPdfName);
  expect(sourceExcerpts.inputPdfPath).toBe(fixtureSet.inputPdfPath);
  expect(sourceExcerpts.sourcePdfTitle).toBe(fixtureSet.sourcePdfTitle);
  expect(sourceExcerpts.documentFamily).toBe(fixtureSet.documentFamily);

  for (const check of fixtureSet.checks) {
    expect(check.checkId).toMatch(/^R-\d-\d{4}$/);
    requireNonEmpty(check.checkName, `${check.checkId} checkName`);
    requireNonEmpty(check.expectedAnswer, `${check.checkId} expectedAnswer`);
    requireNonEmpty(check.whyQuoteIsSufficientOrInsufficient, `${check.checkId} whyQuoteIsSufficientOrInsufficient`);
    expect(check.knownBadQuotesToReject.length).toBeGreaterThan(0);

    for (const rejected of check.knownBadQuotesToReject) {
      requireNonEmpty(rejected.quote, `${check.checkId} rejected quote`);
      requireNonEmpty(rejected.rejectionReason, `${check.checkId} rejection reason`);
    }

    if (check.expectedStatus === "FOUND" || check.expectedStatus === "N/A") {
      requireNonEmpty(check.goldQuote, `${check.checkId} goldQuote`);
      expect(check.page).not.toBeNull();
      expect(check.sectionHeading).not.toBeNull();
    }

    if (check.expectedStatus === "MISSING") {
      expect(check.goldQuote).toBeNull();
      expect(check.page).toBeNull();
      expect(check.sectionHeading).toBeNull();
      requireNonEmpty(check.expectedClientAction, `${check.checkId} expectedClientAction`);
    }

    if (check.expectedStatus === "UNCLEAR") {
      if (check.goldQuote != null) {
        expect(check.page).not.toBeNull();
        expect(check.sectionHeading).not.toBeNull();
      }
      requireNonEmpty(check.expectedClientAction, `${check.checkId} expectedClientAction`);
    }

    if (check.goldQuote != null) {
      const quoteExcerpt = sourceExcerpts.pageExcerpts[String(check.page)];
      expect(quoteExcerpt).toBeTruthy();

      const sectionHeadingPage = check.sectionHeadingPage ?? check.page;
      const headingExcerpt = sourceExcerpts.pageExcerpts[String(sectionHeadingPage)];
      expect(headingExcerpt).toBeTruthy();

      assertQuoteAnchored(check, quoteExcerpt, headingExcerpt);
    }
  }
}

export function assertQuoteDoesNotAppearInSourceExcerpts(
  quote: string,
  sourceExcerpts: SourceExcerpts,
): void {
  const normalizedQuote = normalizeText(quote);
  for (const excerpt of Object.values(sourceExcerpts.pageExcerpts)) {
    expect(normalizeText(excerpt)).not.toContain(normalizedQuote);
  }
}
