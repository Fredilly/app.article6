import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import {
  assertVm0007FullAuditFixtureSet,
  assertVm0007JudgmentFixtureSet,
  type FullAuditFixtureSet,
  type JudgmentFixtureSet,
  type SourceExcerpts,
} from "./preverifJudgmentFixtureGate";
import { VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const ENVIRA_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const FULL_AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-full-audit-fixture-shape.json", "utf8"),
) as FullAuditFixtureSet;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

describe("preverifJudgmentFixtureGate", () => {
  it("accepts the current Envira judgment fixture set including continuation-page headings", () => {
    assertVm0007JudgmentFixtureSet(ENVIRA_FIXTURE, SOURCE_EXCERPTS);
  });

  it("rejects a wrong continuation-page heading page", () => {
    const mutated = JSON.parse(JSON.stringify(ENVIRA_FIXTURE)) as JudgmentFixtureSet;
    mutated.checks = mutated.checks.map((check) =>
      check.checkId === "R-1-0004"
        ? { ...check, sectionHeadingPage: 37 }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(mutated, SOURCE_EXCERPTS)).toThrow();
  });

  it("accepts the finalized full 58-rule Envira fixture shape", () => {
    assertVm0007FullAuditFixtureSet(FULL_AUDIT_FIXTURE, VM0007_SYNCED_RULES, SOURCE_EXCERPTS);
  });

  it("rejects not-applicable rows that invent evidence or client action", () => {
    const mutated = JSON.parse(JSON.stringify(FULL_AUDIT_FIXTURE)) as FullAuditFixtureSet;
    mutated.checks = mutated.checks.map((check) =>
      check.checkId === "R-1-0005"
        ? {
            ...check,
            evidence: {
              quote: "Invented not-applicable proof.",
              page: 32,
              sectionHeading: "2.2 Applicability of Methodology",
              sectionHeadingPage: 32,
              spanId: null,
            },
            page: 32,
            sectionHeading: "2.2 Applicability of Methodology",
            clientAction: "Should not exist.",
          }
        : check,
    );

    expect(() => assertVm0007FullAuditFixtureSet(mutated, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
  });
});
