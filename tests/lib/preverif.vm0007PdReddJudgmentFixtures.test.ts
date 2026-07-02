import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import {
  assertQuoteDoesNotAppearInSourceExcerpts,
  assertVm0007JudgmentFixtureSet,
  type JudgmentFixtureSet,
  type SourceExcerpts,
} from "./preverifJudgmentFixtureGate";

const AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const ENVIRA_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

const ENVIRA_SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

describe("PD_REDD VM0007 judgment fixtures", () => {
  it("confirms the exact source document is the PD_REDD project description PDF", () => {
    expect(AUDIT_FIXTURE.inputPdfName).toBe("PD_REDD_v1_130.pdf");
    expect(AUDIT_FIXTURE.inputPdfPath).toBe("/Users/stphen/Desktop/test folder/VCS:2324/PD_REDD_v1_130.pdf");
    expect(AUDIT_FIXTURE.sourcePdfTitle).toBe(
      "PROJECT DESCRIPTION: VCS Version 3 — Community Based Avoided Deforestation Project in Guinea-Bissau",
    );
    expect(AUDIT_FIXTURE.documentFamily).toBe("Project Description / PD");
    expect(SOURCE_EXCERPTS.sourceTypeConfirmation.page).toBe(1);
    expect(SOURCE_EXCERPTS.sourceTypeConfirmation.quote).toContain("PROJECT DESCRIPTION: VCS");
    expect(SOURCE_EXCERPTS.sourceTypeConfirmation.quote).toContain("COMMUNITY BASED AVOIDED DEFORESTATION PROJECT");
  });

  it("anchors every gold quote and section heading to exact excerpts from the specified PDF", () => {
    assertVm0007JudgmentFixtureSet(AUDIT_FIXTURE, SOURCE_EXCERPTS);
  });

  it("keeps PD_REDD quotes out of the Envira source excerpts", () => {
    const pdrQuote = AUDIT_FIXTURE.checks.find((check) => check.checkId === "R-2-0014")?.goldQuote;
    expect(pdrQuote).toBeTruthy();
    assertQuoteDoesNotAppearInSourceExcerpts(pdrQuote!, ENVIRA_SOURCE_EXCERPTS);
  });

  it("fails when a PD_REDD quote is stitched, paraphrased, on the wrong page, or on the wrong section", () => {
    const stitched = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    stitched.checks = stitched.checks.map((check) =>
      check.checkId === "R-5-0003"
        ? {
            ...check,
            goldQuote: "Leakage emissions accounted for are entirely from displacement of unplanned deforestation and were estimated applying the LK-ASU (v1.0) module. The initial PRA indicated that the agents of deforestation comprise in majority the local population",
          }
        : check,
    );

    const paraphrased = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    paraphrased.checks = paraphrased.checks.map((check) =>
      check.checkId === "R-4-0001"
        ? {
            ...check,
            goldQuote: "The project uses VT0001 and has financial, institutional, and first-of-its-kind barriers.",
          }
        : check,
    );

    const wrongPage = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    wrongPage.checks = wrongPage.checks.map((check) =>
      check.checkId === "R-3-0001"
        ? { ...check, page: 22 }
        : check,
    );

    const wrongSection = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    wrongSection.checks = wrongSection.checks.map((check) =>
      check.checkId === "R-6-0002"
        ? { ...check, sectionHeading: "1.12.4 Participation under Other GHG Programs" }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(stitched, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(paraphrased, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(wrongPage, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(wrongSection, SOURCE_EXCERPTS)).toThrow();
  });

  it("fails when Envira evidence is injected into PD_REDD fixtures", () => {
    const mutated = JSON.parse(JSON.stringify(ENVIRA_FIXTURE)) as JudgmentFixtureSet;
    mutated.checks = mutated.checks.map((check) =>
      check.checkId === "R-2-0003"
        ? {
            ...check,
            goldQuote: "The project is not registered or seeking registration under any other GHG Program.",
            page: 22,
            sectionHeading: "1.12.4 Participation under Other GHG Programs",
          }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(mutated, ENVIRA_SOURCE_EXCERPTS)).toThrow();
  });

  it("does not let Envira evidence or answers leak into the PD_REDD fixture set", () => {
    let enviraLeakageGuardCount = 0;

    for (const check of AUDIT_FIXTURE.checks) {
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
    const pdReddWithDifferentStatus = AUDIT_FIXTURE.checks.find((check) => {
      const envira = enviraByRule.get(check.checkId);
      return envira && envira.expectedStatus !== check.expectedStatus;
    });

    expect(pdReddWithDifferentStatus?.checkId).toBe("R-1-0004");
    expect(enviraByRule.get("R-1-0004")?.expectedStatus).toBe("UNCLEAR");
    expect(AUDIT_FIXTURE.checks.find((check) => check.checkId === "R-1-0004")?.expectedStatus).toBe("N/A");
  });
});
