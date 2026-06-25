import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { resolveQuickCheckMethodology, resolvePrimaryMethodology } from "@/lib/chat/quickCheckMethodology";

const methods = [
  { code: "VM0007", latestVersion: "v1-0", versions: ["v1-0"] },
];

const CCB_RAW_TEXT = `CCBA Project Validation Report
Climate, Community & Biodiversity Project Design Standards Second Edition

Section 2: Joint Assessment
This validation report documents the joint assessment of the project. The validation was carried out under the Verified Carbon Standard (VCS) and the REDD methodology VM0007, in combination with the Climate, Community and Biodiversity (CCB) Standards.

Section 3: Audit Summary
A team of auditors including a VCS AFOLU expert reviewed the project documentation.
The auditor qualifications are attached in Appendix A.

VM0007
`;

const VCS_RAW_TEXT = `VALIDATION REPORT VCS Version 3
against the Verified Carbon Standard version 3.3 and its supporting documents including the approved methodology VM0007 version 1.3 REDD Methodology Modules
VM0007
`;

describe("CCB regression — resolvePrimaryMethodology", () => {
  it("must return null for CCB validation report text (VM0007 in joint-assessment context)", () => {
    const result = resolvePrimaryMethodology({
      mentions: ["VM0007", "VCS", "CCB"],
      methods,
      rawText: CCB_RAW_TEXT,
    });
    expect(result).toBeNull();
  });

  it("must return VM0007 for VCS validation report text (primary context)", () => {
    const result = resolvePrimaryMethodology({
      mentions: ["VM0007", "VCS"],
      methods,
      rawText: VCS_RAW_TEXT,
    });
    expect(result).not.toBeNull();
    expect(result?.canonicalKey).toBe("VM0007");
  });

  it("must return 'deferred' status for CCB report in resolveQuickCheckMethodology", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["VM0007", "VCS", "CCB", "VM0007"],
      methods,
      rawText: CCB_RAW_TEXT,
    });
    expect(result.status).toBe("deferred");
    expect(result.primaryMethodology).toBeNull();
    expect(result.matchedMethods.length).toBeGreaterThanOrEqual(1);
  });

  it("must return 'single' for VCS report in resolveQuickCheckMethodology", () => {
    const result = resolveQuickCheckMethodology({
      mentions: ["VM0007", "VCS"],
      methods,
      rawText: VCS_RAW_TEXT,
    });
    expect(result.status).toBe("single");
    expect(result.primaryMethodology?.canonicalKey).toBe("VM0007");
  });
});
