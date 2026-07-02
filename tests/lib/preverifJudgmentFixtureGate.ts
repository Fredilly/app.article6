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

function expectNonEmpty(value: string | null | undefined, label: string): void {
  expect(value?.trim().length ?? 0).toBeGreaterThan(0);
}

function requireQuoteSourceMatch(check: JudgmentFixture, excerpt: string): void {
  expectNonEmpty(check.goldQuote, `${check.checkId} goldQuote`);
  expect(normalizeText(excerpt)).toContain(normalizeText(check.goldQuote));
}

function requireSectionMatch(check: JudgmentFixture, excerpt: string): void {
  expectNonEmpty(check.sectionHeading, `${check.checkId} sectionHeading`);
  expect(normalizeText(excerpt)).toContain(normalizeText(check.sectionHeading));
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
    expectNonEmpty(check.checkName, `${check.checkId} checkName`);
    expectNonEmpty(check.expectedAnswer, `${check.checkId} expectedAnswer`);
    expectNonEmpty(check.whyQuoteIsSufficientOrInsufficient, `${check.checkId} whyQuoteIsSufficientOrInsufficient`);
    expect(check.knownBadQuotesToReject.length).toBeGreaterThan(0);

    for (const rejected of check.knownBadQuotesToReject) {
      expectNonEmpty(rejected.quote, `${check.checkId} rejected quote`);
      expectNonEmpty(rejected.rejectionReason, `${check.checkId} rejection reason`);
    }

    if (check.expectedStatus === "FOUND" || check.expectedStatus === "N/A") {
      expectNonEmpty(check.goldQuote, `${check.checkId} goldQuote`);
      expect(check.page).not.toBeNull();
      expect(check.sectionHeading).not.toBeNull();
    }

    if (check.expectedStatus === "MISSING") {
      expect(check.goldQuote).toBeNull();
      expect(check.page).toBeNull();
      expect(check.sectionHeading).toBeNull();
      expectNonEmpty(check.expectedClientAction, `${check.checkId} expectedClientAction`);
    }

    if (check.expectedStatus === "UNCLEAR") {
      expectNonEmpty(check.whyQuoteIsSufficientOrInsufficient, `${check.checkId} whyQuoteIsSufficientOrInsufficient`);
      if (check.goldQuote != null) {
        expect(check.page).not.toBeNull();
        expect(check.sectionHeading).not.toBeNull();
      }
      expectNonEmpty(check.expectedClientAction, `${check.checkId} expectedClientAction`);
    }

    if (check.goldQuote != null) {
      expect(check.page).not.toBeNull();
      expect(check.sectionHeading).not.toBeNull();

      const excerpt = sourceExcerpts.pageExcerpts[String(check.page)];
      expect(excerpt).toBeTruthy();
      requireSectionMatch(check, excerpt);
      requireQuoteSourceMatch(check, excerpt);
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

