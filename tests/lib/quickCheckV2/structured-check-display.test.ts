import { describe, expect, it } from "@jest/globals";
import { buildQuickCheckEvidenceStackDisplay } from "@/lib/quickCheckV2/evidenceStackAdapter";
import { buildStructuredCheckDowngradeReason } from "@/lib/quickCheckV2/structuredCheckDisplay";

describe("Quick Check v2 structured check display", () => {
  it("shows UNCLEAR primary and blocker citations with a plain-English reason", () => {
    const evidenceDetails = buildQuickCheckEvidenceStackDisplay([
      {
        role: "primary",
        page: 17,
        quote: "Primary additionality evidence.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.2"],
        spanId: "synthetic-doc:p17:b1",
        sourceType: "exact_section",
      },
      {
        role: "blocker",
        page: 18,
        quote: "The formal VCS additionality section is not required at the Under Development stage.",
        sectionHeading: "Additionality",
        sectionPath: ["3", "3.3"],
        spanId: "synthetic-doc:p18:b1",
        sourceType: "exact_section",
      },
    ]);

    expect(evidenceDetails.map((item) => item.roleLabel)).toStrictEqual(["Primary", "Blocker"]);
    expect(evidenceDetails.map((item) => item.page)).toStrictEqual([17, 18]);

    const reason = buildStructuredCheckDowngradeReason({
      checkId: "additionality",
      reason: "provenance_incomplete",
      evidenceDetails,
    });

    expect(reason).toContain("Relevant additionality evidence exists");
    expect(reason).toContain("formal additionality section is incomplete or marked not required");
    expect(reason).not.toContain("provenance_incomplete");
  });

  it("shows UNCLEAR caveat citations with a plain-English reason", () => {
    const evidenceDetails = buildQuickCheckEvidenceStackDisplay([
      {
        role: "primary",
        page: 11,
        quote: "Leakage emissions are managed.",
        sectionHeading: "Leakage Emissions",
        sectionPath: ["4", "4.3"],
        spanId: "synthetic-doc:p11:b1",
        sourceType: "exact_section",
      },
      {
        role: "caveat",
        page: 12,
        quote: "The formal leakage section is incomplete at the Under Development stage.",
        sectionHeading: "Leakage",
        sectionPath: ["4", "4.4"],
        spanId: "synthetic-doc:p12:b1",
        sourceType: "exact_section",
      },
    ]);

    expect(evidenceDetails.map((item) => item.roleLabel)).toStrictEqual(["Primary", "Caveat"]);
    expect(evidenceDetails.map((item) => item.page)).toStrictEqual([11, 12]);

    const reason = buildStructuredCheckDowngradeReason({
      checkId: "leakage",
      reason: "provenance_incomplete",
      evidenceDetails,
    });

    expect(reason).toContain("Relevant leakage evidence exists");
    expect(reason).toContain("formal leakage section is incomplete at the Under Development stage");
    expect(reason).not.toContain("quote/page/section/span");
  });

  it("does not emit the internal provenance message for client-facing UNCLEAR evidence", () => {
    const evidenceDetails = buildQuickCheckEvidenceStackDisplay([
      {
        role: "primary",
        page: 13,
        quote: "Stakeholder consultation is documented.",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.10"],
        spanId: "synthetic-doc:p13:b1",
        sourceType: "exact_section",
      },
      {
        role: "blocker",
        page: 14,
        quote: "This section is not required at the Under Development stage.",
        sectionHeading: "Stakeholder Consultations",
        sectionPath: ["2", "2.3.11"],
        spanId: "synthetic-doc:p14:b1",
        sourceType: "exact_section",
      },
    ]);

    const reason = buildStructuredCheckDowngradeReason({
      checkId: "stakeholder_consultation",
      reason: "under_development_stub",
      evidenceDetails,
    });

    expect(reason).not.toContain("provenance_incomplete");
    expect(reason).not.toContain("quote/page/section/span");
  });
});
