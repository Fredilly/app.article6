import { describe, expect, it } from "@jest/globals";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";
import { buildPddHeadingIndex, filterPddHeadingsByQuery } from "@/lib/chat/quickCheckSectionExtractor";

/* ------------------------------------------------------------------ */
/*  Synthetic PDD fixtures with deliberately different section numbers */
/*  for the same review-area concepts.                                 */
/* ------------------------------------------------------------------ */

const FIXTURE_A = [
  "2.3 Project Boundary",
  "The project boundary encompasses 5,000 hectares of tropical forest.",
  "Geographic coordinates are provided in the annex.",
  "",
  "2.4 Baseline Scenario",
  "The baseline scenario projects deforestation of 1.2% per year",
  "without the project activity.",
  "",
  "6 STAKEHOLDER COMMENTS",
  "Local communities were consulted through village meetings.",
  "Their feedback has been incorporated into the project design.",
].join("\n");

const FIXTURE_B = [
  "1.7 Site Boundary",
  "The site boundary was delineated using GPS coordinates",
  "around the project intervention area.",
  "",
  "3.2 Baseline Reference Scenario",
  "The reference scenario was constructed using historical land cover",
  "data from 2010 to 2020 for the project region.",
  "",
  "5 Stakeholder Comments and Feedback",
  "Stakeholder feedback was collected through focus group discussions",
  "and key informant interviews.",
].join("\n");

/* --- Versions with a single heading removed (anti-hardcoding check) --- */

const FIXTURE_A_NO_BOUNDARY = [
  "2.4 Baseline Scenario",
  "The baseline scenario projects deforestation of 1.2% per year",
  "without the project activity.",
  "",
  "6 STAKEHOLDER COMMENTS",
  "Local communities were consulted through village meetings.",
  "Their feedback has been incorporated into the project design.",
].join("\n");

const FIXTURE_A_NO_BASELINE = [
  "2.3 Project Boundary",
  "The project boundary encompasses 5,000 hectares of tropical forest.",
  "Geographic coordinates are provided in the annex.",
  "",
  "6 STAKEHOLDER COMMENTS",
  "Local communities were consulted through village meetings.",
  "Their feedback has been incorporated into the project design.",
].join("\n");

const FIXTURE_A_NO_STAKEHOLDER = [
  "2.3 Project Boundary",
  "The project boundary encompasses 5,000 hectares of tropical forest.",
  "Geographic coordinates are provided in the annex.",
  "",
  "2.4 Baseline Scenario",
  "The baseline scenario projects deforestation of 1.2% per year",
  "without the project activity.",
].join("\n");

const FIXTURE_B_NO_BOUNDARY = [
  "3.2 Baseline Reference Scenario",
  "The reference scenario was constructed using historical land cover",
  "data from 2010 to 2020 for the project region.",
  "",
  "5 Stakeholder Comments and Feedback",
  "Stakeholder feedback was collected through focus group discussions",
  "and key informant interviews.",
].join("\n");

const FIXTURE_B_NO_BASELINE = [
  "1.7 Site Boundary",
  "The site boundary was delineated using GPS coordinates",
  "around the project intervention area.",
  "",
  "5 Stakeholder Comments and Feedback",
  "Stakeholder feedback was collected through focus group discussions",
  "and key informant interviews.",
].join("\n");

const FIXTURE_B_NO_STAKEHOLDER = [
  "1.7 Site Boundary",
  "The site boundary was delineated using GPS coordinates",
  "around the project intervention area.",
  "",
  "3.2 Baseline Reference Scenario",
  "The reference scenario was constructed using historical land cover",
  "data from 2010 to 2020 for the project region.",
].join("\n");

/* ================================================================== */
/*  Check 1:  Production-code project/PDD-string scan                  */
/* ================================================================== */

describe("Check 1 — no project/PDD-specific strings in Quick Check runtime code", () => {
  const PROJECT_STRINGS = ["PLUM", "PD_REDD", "Guinea", "Bissau", "Cacheu", "Cantanhez"] as const;

  for (const s of PROJECT_STRINGS) {
    it(`"${s}" does not appear in src/lib/chat/ (Quick Check runtime)`, async () => {
      const { execSync } = await import("child_process");
      const result = execSync(`grep -rl "${s}" src/lib/chat/ 2>/dev/null || true`, {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      expect(result.trim()).toBe("");
    });
  }

  it("PLUM appears only in proofMap/aoi.ts (geospatial area-of-interest feature, not Quick Check)", async () => {
    const { execSync } = await import("child_process");
    const result = execSync(`grep -rl "PLUM" src/lib/ 2>/dev/null || true`, {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    const files = result.trim().split("\n").filter(Boolean);
    const quickCheckFiles = files.filter((f: string) => f.includes("chat/"));
    expect(quickCheckFiles).toEqual([]);
  });
});

/* ================================================================== */
/*  Check 2:  Same question → different section numbers per document   */
/* ================================================================== */

describe("Check 2 — cross-document genericity: same question, different fixture", () => {
  const Q_BOUNDARY = "Does this PDD describe the project boundary?";
  const Q_BASELINE = "Does this PDD explain the baseline scenario?";
  const Q_STAKEHOLDER = "Does this PDD include stakeholder comments?";

  const opts = { methodologyId: "VM9999", methodologyVersion: "9.9" };

  it("boundary query returns section 2.3 on Fixture A but 1.7 on Fixture B", () => {
    const a = buildReviewQuestionResult({ ...opts, claimText: Q_BOUNDARY, rawPddText: FIXTURE_A });
    const b = buildReviewQuestionResult({ ...opts, claimText: Q_BOUNDARY, rawPddText: FIXTURE_B });
    expect(a.relevantSections).toContain("2.3");
    expect(b.relevantSections).toContain("1.7");
    expect(a.relevantSections).not.toEqual(b.relevantSections);
  });

  it("baseline query returns section 2.4 on Fixture A but 3.2 on Fixture B", () => {
    const a = buildReviewQuestionResult({ ...opts, claimText: Q_BASELINE, rawPddText: FIXTURE_A });
    const b = buildReviewQuestionResult({ ...opts, claimText: Q_BASELINE, rawPddText: FIXTURE_B });
    expect(a.relevantSections).toContain("2.4");
    expect(b.relevantSections).toContain("3.2");
    expect(a.relevantSections).not.toEqual(b.relevantSections);
  });

  it("stakeholder query returns section 6 on Fixture A but 5 on Fixture B", () => {
    const a = buildReviewQuestionResult({ ...opts, claimText: Q_STAKEHOLDER, rawPddText: FIXTURE_A });
    const b = buildReviewQuestionResult({ ...opts, claimText: Q_STAKEHOLDER, rawPddText: FIXTURE_B });
    expect(a.relevantSections).toContain("6");
    expect(b.relevantSections).toContain("5");
    expect(a.relevantSections).not.toEqual(b.relevantSections);
  });
});

/* ================================================================== */
/*  Check 3:  Negative-topic tests — unrelated questions → no match    */
/* ================================================================== */

describe("Check 3 — unknown topics return no match", () => {
  const opts = { methodologyId: "VM9999", methodologyVersion: "9.9" };
  const fixtures = [FIXTURE_A, FIXTURE_B];

  const UNRELATED_QUESTIONS = [
    "Does this PDD describe blue whale migration?",
    "Does this PDD explain cryptocurrency mining?",
    "Does this PDD include Mars colony monitoring?",
  ];

  for (const question of UNRELATED_QUESTIONS) {
    describe(question, () => {
      for (let i = 0; i < fixtures.length; i++) {
        it(`no confident section match on Fixture ${i === 0 ? "A" : "B"}`, () => {
          const result = buildReviewQuestionResult({ ...opts, claimText: question, rawPddText: fixtures[i]! });
          expect(result.relevantSections).toEqual([]);
          expect(result.matchedHeadings).toEqual([]);
        });
      }
    });
  }
});

/* ================================================================== */
/*  Check 4:  Anti-hardcoding — every match is rooted in the fixture   */
/* ================================================================== */

describe("Check 4 — anti-hardcoding assertions", () => {
  const opts = { methodologyId: "VM9999", methodologyVersion: "9.9" };

  const SCENARIOS: { label: string; fixture: string; query: string; expectedSection: string }[] = [
    { label: "A-boundary", fixture: FIXTURE_A, query: "Does this PDD describe the project boundary?", expectedSection: "2.3" },
    { label: "A-baseline", fixture: FIXTURE_A, query: "Does this PDD explain the baseline scenario?", expectedSection: "2.4" },
    { label: "A-stakeholder", fixture: FIXTURE_A, query: "Does this PDD include stakeholder comments?", expectedSection: "6" },
    { label: "B-boundary", fixture: FIXTURE_B, query: "Does this PDD describe the project boundary?", expectedSection: "1.7" },
    { label: "B-baseline", fixture: FIXTURE_B, query: "Does this PDD explain the baseline scenario?", expectedSection: "3.2" },
    { label: "B-stakeholder", fixture: FIXTURE_B, query: "Does this PDD include stakeholder comments?", expectedSection: "5" },
  ];

  /* ------ 4a: Section exists in the extracted heading index ------ */
  describe("4a — section number exists in the extracted heading index", () => {
    for (const { label, fixture, query, expectedSection } of SCENARIOS) {
      it(`${label}: section ${expectedSection} is in headingIndex`, () => {
        const result = buildReviewQuestionResult({ ...opts, claimText: query, rawPddText: fixture });
        expect(result.relevantSections).toContain(expectedSection);
        const found = result.headingIndex.find((h) => h.sectionNumber === expectedSection);
        expect(found).toBeDefined();
      });
    }
  });

  /* ------ 4b: Title and body text come from the fixture text ------ */
  describe("4b — title and body text come from the uploaded document text", () => {
    for (const { label, fixture, query, expectedSection } of SCENARIOS) {
      it(`${label}: matched heading content is present verbatim in fixture`, () => {
        const result = buildReviewQuestionResult({ ...opts, claimText: query, rawPddText: fixture });
        const matched = result.matchedHeadings.find((h) => h.sectionNumber === expectedSection);
        expect(matched).toBeDefined();
        expect(fixture).toContain(matched!.title);
        const bodySnippet = matched!.bodyText.slice(0, 60).trim();
        if (bodySnippet.length > 0) {
          expect(fixture.toLowerCase()).toContain(bodySnippet.toLowerCase());
        }
      });
    }
  });

  /* ------ 4c: Removing the heading from the fixture kills the match ------ */
  describe("4c — result not produced if heading is removed from fixture", () => {
    const REMOVAL_SCENARIOS: {
      label: string;
      query: string;
      section: string;
      fullFixture: string;
      truncatedFixture: string;
      otherQuestion: string;
      otherExpectedSection: string;
    }[] = [
      {
        label: "A-boundary",
        query: "Does this PDD describe the project boundary?",
        section: "2.3",
        fullFixture: FIXTURE_A,
        truncatedFixture: FIXTURE_A_NO_BOUNDARY,
        otherQuestion: "Does this PDD explain the baseline scenario?",
        otherExpectedSection: "2.4",
      },
      {
        label: "A-baseline",
        query: "Does this PDD explain the baseline scenario?",
        section: "2.4",
        fullFixture: FIXTURE_A,
        truncatedFixture: FIXTURE_A_NO_BASELINE,
        otherQuestion: "Does this PDD describe the project boundary?",
        otherExpectedSection: "2.3",
      },
      {
        label: "A-stakeholder",
        query: "Does this PDD include stakeholder comments?",
        section: "6",
        fullFixture: FIXTURE_A,
        truncatedFixture: FIXTURE_A_NO_STAKEHOLDER,
        otherQuestion: "Does this PDD explain the baseline scenario?",
        otherExpectedSection: "2.4",
      },
      {
        label: "B-boundary",
        query: "Does this PDD describe the project boundary?",
        section: "1.7",
        fullFixture: FIXTURE_B,
        truncatedFixture: FIXTURE_B_NO_BOUNDARY,
        otherQuestion: "Does this PDD explain the baseline scenario?",
        otherExpectedSection: "3.2",
      },
      {
        label: "B-baseline",
        query: "Does this PDD explain the baseline scenario?",
        section: "3.2",
        fullFixture: FIXTURE_B,
        truncatedFixture: FIXTURE_B_NO_BASELINE,
        otherQuestion: "Does this PDD describe the project boundary?",
        otherExpectedSection: "1.7",
      },
      {
        label: "B-stakeholder",
        query: "Does this PDD include stakeholder comments?",
        section: "5",
        fullFixture: FIXTURE_B,
        truncatedFixture: FIXTURE_B_NO_STAKEHOLDER,
        otherQuestion: "Does this PDD include stakeholder comments?",
        otherExpectedSection: "",
      },
    ];

    for (const { label, query, section, fullFixture, truncatedFixture, otherQuestion, otherExpectedSection } of REMOVAL_SCENARIOS) {
      it(`${label}: section ${section} is NOT returned when removed from text`, () => {
        const result = buildReviewQuestionResult({ ...opts, claimText: query, rawPddText: truncatedFixture });
        expect(result.relevantSections).not.toContain(section);
      });

      if (otherExpectedSection) {
        it(`${label}: other unrelated headings still match after removal`, () => {
          const result = buildReviewQuestionResult({ ...opts, claimText: otherQuestion, rawPddText: truncatedFixture });
          expect(result.relevantSections).toContain(otherExpectedSection);
        });
      }
    }
  });
});
