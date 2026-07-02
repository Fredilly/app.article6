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

export type CanonicalVm0007Rule = {
  id: string;
  summary?: string | null;
  title?: string | null;
};

export type FullAuditEvidence = {
  quote: string;
  page: number;
  sectionHeading: string;
  sectionHeadingPage?: number | null;
  spanId?: string | null;
};

export type FullAuditFixtureCheck = {
  checkId: string;
  checkName: string;
  expectedStatus: FixtureStatus;
  expectedAnswer: string | null;
  evidence: FullAuditEvidence | null;
  page: number | null;
  sectionHeading: string | null;
  sectionHeadingPage?: number | null;
  spanId: string | null;
  clientAction: string | null;
  reason: string;
};

export type FullAuditFixtureSet = {
  fixtureSetId: string;
  title: string;
  inputPdfName: string;
  inputPdfPath: string;
  sourcePdfTitle: string;
  documentFamily: string;
  methodology: string;
  fixtureTruthPolicy: string;
  expectedWarnings: string[];
  expectedTotalRules: number;
  expectedStatusCounts: Record<FixtureStatus, number>;
  checks: FullAuditFixtureCheck[];
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

function findHeadingExcerpt(
  sourceExcerpts: SourceExcerpts,
  page: number | null,
  sectionHeading: string | null,
  sectionHeadingPage?: number | null,
): string {
  requireNonEmpty(sectionHeading, "sectionHeading");
  expect(page).not.toBeNull();

  const candidatePages = [sectionHeadingPage, page, (page ?? 0) - 1]
    .filter((value, index, values): value is number => value != null && value > 0 && values.indexOf(value) === index);

  for (const candidatePage of candidatePages) {
    const excerpt = sourceExcerpts.pageExcerpts[String(candidatePage)];
    if (excerpt && normalizeText(excerpt).includes(normalizeText(sectionHeading))) {
      return excerpt;
    }
  }

  const fallbackExcerpt = sourceExcerpts.pageExcerpts[String(candidatePages[0] ?? page)];
  expect(fallbackExcerpt).toBeTruthy();
  return fallbackExcerpt!;
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
      const headingExcerpt = findHeadingExcerpt(
        sourceExcerpts,
        check.page,
        check.sectionHeading,
        check.sectionHeadingPage,
      );

      assertQuoteAnchored(check, quoteExcerpt, headingExcerpt);
    }
  }
}

function assertStatusCountsMatch(
  checks: Array<{ expectedStatus: FixtureStatus }>,
  expectedStatusCounts: Record<FixtureStatus, number>,
  expectedTotalRules: number,
): void {
  const actualStatusCounts: Record<FixtureStatus, number> = {
    FOUND: 0,
    UNCLEAR: 0,
    MISSING: 0,
    "N/A": 0,
  };

  for (const check of checks) {
    actualStatusCounts[check.expectedStatus] += 1;
  }

  expect(
    expectedStatusCounts.FOUND
      + expectedStatusCounts.UNCLEAR
      + expectedStatusCounts.MISSING
      + expectedStatusCounts["N/A"],
  ).toBe(expectedTotalRules);
  expect(actualStatusCounts).toEqual(expectedStatusCounts);
}

function assertFullAuditQuoteAnchored(
  check: FullAuditFixtureCheck,
  sourceExcerpts: SourceExcerpts,
): void {
  expect(check.evidence).not.toBeNull();
  requireNonEmpty(check.sectionHeading, `${check.checkId} sectionHeading`);
  expect(check.page).not.toBeNull();

  const evidence = check.evidence!;
  expect(evidence.page).toBe(check.page);
  expect(evidence.sectionHeading).toBe(check.sectionHeading);
  expect(evidence.sectionHeadingPage ?? evidence.page).toBe(check.sectionHeadingPage ?? check.page);
  expect(evidence.spanId ?? null).toBe(check.spanId);

  const quoteExcerpt = sourceExcerpts.pageExcerpts[String(check.page)];
  expect(quoteExcerpt).toBeTruthy();
  const headingExcerpt = findHeadingExcerpt(
    sourceExcerpts,
    check.page,
    check.sectionHeading,
    check.sectionHeadingPage,
  );

  expect(normalizeText(quoteExcerpt)).toContain(normalizeText(evidence.quote));
  expect(normalizeText(headingExcerpt)).toContain(normalizeText(check.sectionHeading));
}

export function assertVm0007FullAuditFixtureSet(
  fixtureSet: FullAuditFixtureSet,
  canonicalRules: CanonicalVm0007Rule[],
  sourceExcerpts: SourceExcerpts,
): void {
  expect(fixtureSet.methodology).toBe("VM0007");
  expect(sourceExcerpts.inputPdfName).toBe(fixtureSet.inputPdfName);
  expect(sourceExcerpts.inputPdfPath).toBe(fixtureSet.inputPdfPath);
  expect(sourceExcerpts.sourcePdfTitle).toBe(fixtureSet.sourcePdfTitle);
  expect(sourceExcerpts.documentFamily).toBe(fixtureSet.documentFamily);

  const canonicalRuleIds = canonicalRules.map((rule) => rule.id);
  const canonicalRuleIdSet = new Set(canonicalRuleIds);
  expect(canonicalRules).toHaveLength(58);
  expect(canonicalRuleIdSet.size).toBe(58);

  const fixtureRuleIds = fixtureSet.checks.map((check) => check.checkId);
  const fixtureRuleIdSet = new Set(fixtureRuleIds);

  expect(fixtureSet.expectedTotalRules).toBe(58);
  expect(fixtureSet.checks).toHaveLength(58);
  expect(fixtureRuleIdSet.size).toBe(58);
  expect([...fixtureRuleIds].sort()).toEqual([...canonicalRuleIds].sort());

  assertStatusCountsMatch(fixtureSet.checks, fixtureSet.expectedStatusCounts, fixtureSet.expectedTotalRules);

  for (const check of fixtureSet.checks) {
    expect(canonicalRuleIdSet.has(check.checkId)).toBe(true);
    requireNonEmpty(check.checkName, `${check.checkId} checkName`);
    requireNonEmpty(check.reason, `${check.checkId} reason`);
    expect(Object.prototype.hasOwnProperty.call(check, "expectedAnswer")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(check, "evidence")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(check, "page")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(check, "sectionHeading")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(check, "spanId")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(check, "clientAction")).toBe(true);

    if (check.expectedAnswer != null) {
      requireNonEmpty(check.expectedAnswer, `${check.checkId} expectedAnswer`);
    }

    if (check.expectedStatus === "FOUND") {
      expect(check.evidence).not.toBeNull();
      expect(check.page).not.toBeNull();
      expect(check.sectionHeading).not.toBeNull();
      expect(check.expectedAnswer).not.toBeNull();
      assertFullAuditQuoteAnchored(check, sourceExcerpts);
    }

    if (check.expectedStatus === "UNCLEAR") {
      requireNonEmpty(check.clientAction, `${check.checkId} clientAction`);
      if (check.evidence != null) {
        assertFullAuditQuoteAnchored(check, sourceExcerpts);
      } else {
        expect(check.page).toBeNull();
        expect(check.sectionHeading).toBeNull();
      }
    }

    if (check.expectedStatus === "MISSING") {
      expect(check.evidence).toBeNull();
      expect(check.page).toBeNull();
      expect(check.sectionHeading).toBeNull();
      expect(check.spanId).toBeNull();
      requireNonEmpty(check.clientAction, `${check.checkId} clientAction`);
    }

    if (check.expectedStatus === "N/A") {
      expect(normalizeText(check.reason)).toMatch(/not applicable|does not apply|not apply/);
      if (check.evidence != null) {
        assertFullAuditQuoteAnchored(check, sourceExcerpts);
      }
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
