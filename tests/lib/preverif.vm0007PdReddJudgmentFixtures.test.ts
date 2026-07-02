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

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

const ENVIRA_SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

describe("PD_REDD VM0007 judgment fixtures", () => {
  it("anchors every gold quote and section heading to exact excerpts from the specified PDF", () => {
    assertVm0007JudgmentFixtureSet(AUDIT_FIXTURE, SOURCE_EXCERPTS);
  });

  it("keeps PD_REDD quotes out of the Envira source excerpts", () => {
    const pdrQuote = AUDIT_FIXTURE.checks.find((check) => check.checkId === "R-2-0014")?.goldQuote;
    expect(pdrQuote).toBeTruthy();
    assertQuoteDoesNotAppearInSourceExcerpts(pdrQuote!, ENVIRA_SOURCE_EXCERPTS);
  });

  it("fails when a PD_REDD quote is stitched or paraphrased", () => {
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
            goldQuote: "Funding cuts would increase deforestation pressure and the project would likely accelerate existing trends.",
          }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(stitched, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(paraphrased, SOURCE_EXCERPTS)).toThrow();
  });
});
