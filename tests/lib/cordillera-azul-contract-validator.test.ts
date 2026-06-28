/**
 * Cordillera Azul Reliability Contract Validator
 *
 * Validates every check entry in the JSON fixture contract has all
 * required fields populated. This is a schema/contract test — it does
 * not run the Quick Check pipeline.
 *
 * If this test fails, the contract is malformed and must be fixed
 * before any assertions can be trusted.
 */

import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";

const CONTRACT_PATH = path.join(
  process.cwd(),
  "tests/fixtures/quick-check/cordillera-azul-reliability-contract.json"
);
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf-8"));

const REQUIRED_CHECK_FIELDS = [
  "fixtureId",
  "sourceFile",
  "check",
  "expectedStatus",
  "expectedAnswer",
  "expectedDocumentFamily",
  "evidence",
  "weakEvidenceToReject",
  "mustNotClassifyAs",
  "bugPrevented",
  "strictEvalEligible",
  "blockedBy",
] as const;

const REQUIRED_EVIDENCE_FIELDS = ["page", "quote"] as const;

const VALID_STATUSES = ["answered", "unclear", "not_found"] as const;

describe("Cordillera Azul reliability contract schema", () => {
  it("contract file has valid JSON structure", () => {
    expect(contract).toBeDefined();
    expect(contract.description).toBeDefined();
    expect(Array.isArray(contract.fixtures)).toBe(true);
    expect(contract.fixtures.length).toBeGreaterThanOrEqual(2);
  });

  it("every fixture has fixtureId, sourceFile, documentKind, expectedDocumentFamily", () => {
    for (const fx of contract.fixtures) {
      expect(fx.fixtureId).toBeDefined();
      expect(typeof fx.fixtureId).toBe("string");
      expect(fx.fixtureId.length).toBeGreaterThan(0);

      expect(fx.sourceFile).toBeDefined();
      expect(typeof fx.sourceFile).toBe("string");

      expect(fx.documentKind).toBeDefined();
      expect(typeof fx.documentKind).toBe("string");

      expect(fx.expectedDocumentFamily).toBeDefined();
      expect(typeof fx.expectedDocumentFamily).toBe("string");
    }
  });

  it("every fixture has at least one check", () => {
    for (const fx of contract.fixtures) {
      expect(fx.checks.length).toBeGreaterThan(0);
    }
  });

  it("every check has all required fields", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        for (const field of REQUIRED_CHECK_FIELDS) {
          expect(check).toHaveProperty(field);
          // Evidence must not be null at the field level
          if (field === "evidence") {
            for (const evField of REQUIRED_EVIDENCE_FIELDS) {
              expect(check.evidence).toHaveProperty(evField);
            }
          }
        }
      }
    }
  });

  it("every check has a valid expectedStatus", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(VALID_STATUSES.includes(check.expectedStatus as typeof VALID_STATUSES[number])).toBe(true);
      }
    }
  });

  it("every check has a non-empty fixtureId matching its parent", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(check.fixtureId).toBe(fx.fixtureId);
      }
    }
  });

  it("every check has a non-empty sourceFile matching its parent", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(check.sourceFile).toBe(fx.sourceFile);
      }
    }
  });

  it("every weakEvidenceToReject is a non-empty array", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(Array.isArray(check.weakEvidenceToReject)).toBe(true);
      }
    }
  });

  it("every mustNotClassifyAs is an array", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(Array.isArray(check.mustNotClassifyAs)).toBe(true);
      }
    }
  });

  it("every blockedBy is a non-empty array", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(Array.isArray(check.blockedBy)).toBe(true);
      }
    }
  });

  it("every strictEvalEligible is false (not ready for strict eval)", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(check.strictEvalEligible).toBe(false);
      }
    }
  });

  it("CCB fixture does NOT have a plain 'methodology' check — split into primary_methodology + supporting_carbon_methodology", () => {
    const ccbFixture = contract.fixtures.find(
      (fx) => fx.fixtureId === "cordillera-azul-ccb-validation-2013"
    );
    expect(ccbFixture).toBeDefined();

    const methodologyCheck = ccbFixture!.checks.find(
      (c) => c.check === "methodology"
    );
    expect(methodologyCheck).toBeUndefined();

    const primaryCheck = ccbFixture!.checks.find(
      (c) => c.check === "primary_methodology"
    );
    expect(primaryCheck).toBeDefined();
    expect(primaryCheck!.expectedStatus).toBe("not_found");
    expect(primaryCheck!.expectedAnswer).toBeNull();
    expect(primaryCheck!.mustNotClassifyAs).toContain("VM0007_PRIMARY");

    const supportingCheck = ccbFixture!.checks.find(
      (c) => c.check === "supporting_carbon_methodology"
    );
    expect(supportingCheck).toBeDefined();
    expect(supportingCheck!.expectedStatus).toBe("answered");
    expect(supportingCheck!.expectedAnswer).toBe("VM0007");
    expect(supportingCheck!.role).toBe("supporting_carbon_accounting_reference");
  });

  it("every evidence.page is either a number or null", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(
          check.evidence.page === null || typeof check.evidence.page === "number"
        ).toBe(true);
      }
    }
  });

  it("every bugPrevented is a non-empty string", () => {
    for (const fx of contract.fixtures) {
      for (const check of fx.checks) {
        expect(typeof check.bugPrevented).toBe("string");
        expect(check.bugPrevented.length).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("total check count matches expected", () => {
    let total = 0;
    for (const fx of contract.fixtures) {
      total += fx.checks.length;
    }
    // 4 fixtures × 11-12 checks each = 45 total
    expect(total).toBe(45);
  });
});
