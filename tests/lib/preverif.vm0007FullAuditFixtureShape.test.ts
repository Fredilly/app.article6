import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import {
  assertVm0007FullAuditFixtureSet,
  type FullAuditFixtureSet,
  type SourceExcerpts,
} from "./preverifJudgmentFixtureGate";
import { VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const FULL_AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-full-audit-fixture-shape.json", "utf8"),
) as FullAuditFixtureSet;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

function cloneFixture(): FullAuditFixtureSet {
  return JSON.parse(JSON.stringify(FULL_AUDIT_FIXTURE)) as FullAuditFixtureSet;
}

describe("VM0007 full 58-rule audit fixture shape", () => {
  it("uses the canonical synced VM0007 rule list and confirms the expected total is 58", () => {
    expect(VM0007_SYNCED_RULES).toHaveLength(58);
    expect(new Set(VM0007_SYNCED_RULES.map((rule) => rule.id)).size).toBe(58);
  });

  it("represents all 58 canonical rules with stable summary counts", () => {
    assertVm0007FullAuditFixtureSet(FULL_AUDIT_FIXTURE, VM0007_SYNCED_RULES, SOURCE_EXCERPTS);
    expect(FULL_AUDIT_FIXTURE.expectedStatusCounts).toEqual({
      FOUND: 31,
      UNCLEAR: 7,
      MISSING: 3,
      "N/A": 17,
    });

    const r6004 = FULL_AUDIT_FIXTURE.checks.find((check) => check.checkId === "R-6-0004");
    expect(r6004?.expectedStatus).toBe("UNCLEAR");
  });

  it("fails if a canonical rule is missing, a non-canonical rule is added, or a duplicate checkId exists", () => {
    const missingRule = cloneFixture();
    missingRule.checks = missingRule.checks.filter((check) => check.checkId !== "R-6-0008");

    const nonCanonicalRule = cloneFixture();
    nonCanonicalRule.checks[0] = {
      ...nonCanonicalRule.checks[0]!,
      checkId: "R-9-9999",
    };

    const duplicateRule = cloneFixture();
    duplicateRule.checks[1] = {
      ...duplicateRule.checks[1]!,
      checkId: duplicateRule.checks[0]!.checkId,
    };

    expect(() => assertVm0007FullAuditFixtureSet(missingRule, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007FullAuditFixtureSet(nonCanonicalRule, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007FullAuditFixtureSet(duplicateRule, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
  });

  it("fails if summary counts drift, FOUND loses provenance, or weak statuses lose required guidance", () => {
    const wrongCounts = cloneFixture();
    wrongCounts.expectedStatusCounts = {
      ...wrongCounts.expectedStatusCounts,
      MISSING: wrongCounts.expectedStatusCounts.MISSING - 1,
    };

    const foundWithoutProvenance = cloneFixture();
    foundWithoutProvenance.checks = foundWithoutProvenance.checks.map((check) =>
      check.checkId === "R-2-0003"
        ? {
            ...check,
            evidence: null,
            page: null,
            sectionHeading: null,
          }
        : check,
    );

    const unclearWithoutGuidance = cloneFixture();
    unclearWithoutGuidance.checks = unclearWithoutGuidance.checks.map((check) =>
      check.checkId === "R-1-0004"
        ? {
            ...check,
            clientAction: null,
            reason: "",
          }
        : check,
    );

    const missingWithoutGuidance = cloneFixture();
    missingWithoutGuidance.checks = missingWithoutGuidance.checks.map((check) =>
      check.checkId === "R-1-0013"
        ? {
            ...check,
            clientAction: null,
            reason: "",
          }
        : check,
    );

    expect(() => assertVm0007FullAuditFixtureSet(wrongCounts, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007FullAuditFixtureSet(foundWithoutProvenance, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007FullAuditFixtureSet(unclearWithoutGuidance, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007FullAuditFixtureSet(missingWithoutGuidance, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
  });

  it("fails if a rule is marked N/A without an explicit not-applicable reason", () => {
    const invalidNa = cloneFixture();
    invalidNa.checks = invalidNa.checks.map((check) =>
      check.checkId === "R-1-0001"
        ? {
            ...check,
            expectedStatus: "N/A",
            clientAction: null,
            reason: "Scope decision pending review.",
          }
        : check,
    );
    invalidNa.expectedStatusCounts = {
      ...invalidNa.expectedStatusCounts,
      MISSING: invalidNa.expectedStatusCounts.MISSING - 1,
      "N/A": invalidNa.expectedStatusCounts["N/A"] + 1,
    };

    expect(() => assertVm0007FullAuditFixtureSet(invalidNa, VM0007_SYNCED_RULES, SOURCE_EXCERPTS)).toThrow();
  });
});
