import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";

type FixtureStatus = "FOUND" | "UNCLEAR" | "MISSING" | "N/A";

type RejectedQuote = {
  quote: string;
  rejectionReason: string;
};

type JudgmentFixture = {
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

type JudgmentFixtureSet = {
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

type SourceExcerpts = {
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

type PhaseStatus = {
  goals: Array<{
    id: string;
    status: string;
  }>;
  phases: Record<string, {
    status: string;
    summary: string;
  }>;
};

const PD_REDD_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const PD_REDD_SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

const ENVIRA_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const PHASE_STATUS = JSON.parse(
  fs.readFileSync("docs/roadmaps/vm0007-judgement-fixtures/phase-status.json", "utf8"),
) as PhaseStatus;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

describe("PD_REDD VM0007 judgment fixtures", () => {
  it("confirms the exact source document is the PD_REDD project description PDF and Phase 2 is marked done", () => {
    expect(PD_REDD_FIXTURE.inputPdfName).toBe("PD_REDD_v1_130.pdf");
    expect(PD_REDD_FIXTURE.inputPdfPath).toBe("/Users/stphen/Desktop/test folder/VCS:2324/PD_REDD_v1_130.pdf");
    expect(PD_REDD_FIXTURE.sourcePdfTitle).toBe(
      "PROJECT DESCRIPTION: VCS Version 3 — Community Based Avoided Deforestation Project in Guinea-Bissau",
    );
    expect(PD_REDD_FIXTURE.documentFamily).toBe("Project Description / PD");
    expect(PD_REDD_SOURCE_EXCERPTS.sourceTypeConfirmation.page).toBe(1);
    expect(PD_REDD_SOURCE_EXCERPTS.sourceTypeConfirmation.quote).toContain("PROJECT DESCRIPTION: VCS");
    expect(PD_REDD_SOURCE_EXCERPTS.sourceTypeConfirmation.quote).toContain("COMMUNITY BASED AVOIDED DEFORESTATION PROJECT");

    expect(
      PHASE_STATUS.goals.find((goal) => goal.id === "phase_1_envira_vm0007_judgment_fixtures")?.status,
    ).toBe("done");
    expect(
      PHASE_STATUS.goals.find((goal) => goal.id === "phase_2_pd_redd_vm0007_judgment_fixtures")?.status,
    ).toBe("done");
    expect(PHASE_STATUS.phases.phase_2_pd_redd_vm0007_judgment_fixtures.status).toBe("done");
    expect(PHASE_STATUS.phases.phase_2_pd_redd_vm0007_judgment_fixtures.summary).toContain("PD_REDD");
  });

  it("defines a complete 5-10 check fixture contract with PD_REDD-specific rejection coverage", () => {
    expect(PD_REDD_FIXTURE.methodology).toBe("VM0007");
    expect(PD_REDD_FIXTURE.checks.length).toBeGreaterThanOrEqual(5);
    expect(PD_REDD_FIXTURE.checks.length).toBeLessThanOrEqual(10);
    expect(PD_REDD_FIXTURE.expectedWarnings).toHaveLength(3);

    expect(PD_REDD_FIXTURE.checks.some((check) => check.expectedStatus === "FOUND")).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.expectedStatus === "UNCLEAR")).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.expectedStatus === "MISSING")).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.expectedStatus === "N/A")).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.coverageTags.includes("reject_generic_methodology_text"))).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.coverageTags.includes("reject_module_table_text"))).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.coverageTags.includes("reject_envira_specific_evidence"))).toBe(true);
    expect(PD_REDD_FIXTURE.checks.some((check) => check.coverageTags.includes("same_rule_different_pdf_different_judgment"))).toBe(true);

    for (const check of PD_REDD_FIXTURE.checks) {
      expect(check.checkId).toMatch(/^R-\d-\d{4}$/);
      expect(check.checkName.trim().length).toBeGreaterThan(0);
      expect(check.expectedAnswer.trim().length).toBeGreaterThan(0);
      expect(check.whyQuoteIsSufficientOrInsufficient.trim().length).toBeGreaterThan(0);
      expect(check.knownBadQuotesToReject.length).toBeGreaterThan(0);

      if (check.expectedStatus === "FOUND" || check.expectedStatus === "UNCLEAR" || check.expectedStatus === "N/A") {
        expect(check.goldQuote).not.toBeNull();
        expect(check.page).not.toBeNull();
        expect(check.sectionHeading).not.toBeNull();
      }

      if (check.expectedStatus === "UNCLEAR" || check.expectedStatus === "MISSING" || check.expectedStatus === "N/A") {
        expect(check.expectedClientAction?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("anchors every gold quote and section heading to exact excerpts from the specified PD_REDD PDF", () => {
    expect(PD_REDD_SOURCE_EXCERPTS.inputPdfName).toBe(PD_REDD_FIXTURE.inputPdfName);
    expect(PD_REDD_SOURCE_EXCERPTS.inputPdfPath).toBe(PD_REDD_FIXTURE.inputPdfPath);
    expect(PD_REDD_SOURCE_EXCERPTS.sourcePdfTitle).toBe(PD_REDD_FIXTURE.sourcePdfTitle);
    expect(PD_REDD_SOURCE_EXCERPTS.documentFamily).toBe(PD_REDD_FIXTURE.documentFamily);

    for (const check of PD_REDD_FIXTURE.checks) {
      if (check.page == null) {
        expect(check.goldQuote).toBeNull();
        expect(check.sectionHeading).toBeNull();
        continue;
      }

      const excerpt = PD_REDD_SOURCE_EXCERPTS.pageExcerpts[String(check.page)];
      expect(excerpt).toBeTruthy();
      expect(normalizeText(excerpt)).toContain(normalizeText(check.sectionHeading));
      expect(normalizeText(excerpt)).toContain(normalizeText(check.goldQuote));

      for (const rejected of check.knownBadQuotesToReject) {
        expect(rejected.rejectionReason.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("does not let Envira evidence or answers leak into the PD_REDD fixture set", () => {
    let enviraLeakageGuardCount = 0;

    for (const check of PD_REDD_FIXTURE.checks) {
      expect(normalizeText(check.expectedAnswer)).not.toContain("envira");

      if (check.coverageTags.includes("reject_envira_specific_evidence")) {
        expect(
          check.knownBadQuotesToReject.some((rejected) => normalizeText(rejected.rejectionReason).includes("envira")),
        ).toBe(true);
        enviraLeakageGuardCount += 1;
      }
    }

    expect(enviraLeakageGuardCount).toBeGreaterThan(0);
  });

  it("uses at least one overlapping rule with a different judgment than Envira", () => {
    const enviraByRule = new Map(ENVIRA_FIXTURE.checks.map((check) => [check.checkId, check]));
    const pdReddWithDifferentStatus = PD_REDD_FIXTURE.checks.find((check) => {
      const envira = enviraByRule.get(check.checkId);
      return envira && envira.expectedStatus !== check.expectedStatus;
    });

    expect(pdReddWithDifferentStatus?.checkId).toBe("R-1-0004");
    expect(enviraByRule.get("R-1-0004")?.expectedStatus).toBe("UNCLEAR");
    expect(PD_REDD_FIXTURE.checks.find((check) => check.checkId === "R-1-0004")?.expectedStatus).toBe("N/A");
  });
});
