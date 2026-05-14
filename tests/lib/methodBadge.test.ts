import { describe, it, expect } from "vitest";
import { isSourceAuditedMeta } from "@/lib/methodBadge";

function makeFullMeta(overrides?: Record<string, unknown>): unknown {
  return {
    artifact_status: { rules: "source_audited", sections: "source_audited", source_pdf: "verified" },
    methodology_linked_review_ready: true,
    methodology_linked_review_blockers: [],
    artifact_quality_standard: { adoption_status: "grade_a" },
    ...overrides,
  };
}

describe("isSourceAuditedMeta", () => {
  it("returns true when all conditions are met (grade_a)", () => {
    expect(isSourceAuditedMeta(makeFullMeta())).toBe(true);
  });

  it("returns true when adoption_status is source_audited", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_quality_standard: { adoption_status: "source_audited" } }))
    ).toBe(true);
  });

  it("returns true when adoption_status is s_grade", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_quality_standard: { adoption_status: "s_grade" } }))
    ).toBe(true);
  });

  it("returns false when meta is null", () => {
    expect(isSourceAuditedMeta(null)).toBe(false);
  });

  it("returns false when meta is undefined", () => {
    expect(isSourceAuditedMeta(undefined)).toBe(false);
  });

  it("returns false when rules are not source_audited", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_status: { rules: "draft_unverified", sections: "source_audited", source_pdf: "verified" } }))
    ).toBe(false);
  });

  it("returns false when sections are not source_audited", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_status: { rules: "source_audited", sections: "draft_unverified", source_pdf: "verified" } }))
    ).toBe(false);
  });

  it("returns false when source_pdf is not verified", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_status: { rules: "source_audited", sections: "source_audited", source_pdf: "missing" } }))
    ).toBe(false);
  });

  it("returns false when methodology_linked_review_ready is false", () => {
    expect(isSourceAuditedMeta(makeFullMeta({ methodology_linked_review_ready: false }))).toBe(false);
  });

  it("returns false when blockers exist", () => {
    expect(isSourceAuditedMeta(makeFullMeta({ methodology_linked_review_blockers: ["some blocker"] }))).toBe(false);
  });

  it("returns false when adoption_status is unsupported", () => {
    expect(
      isSourceAuditedMeta(makeFullMeta({ artifact_quality_standard: { adoption_status: "unknown" } }))
    ).toBe(false);
  });

  it("returns false when artifact_status is missing", () => {
    const { artifact_status: _, ...rest } = makeFullMeta() as Record<string, unknown>;
    expect(isSourceAuditedMeta(rest)).toBe(false);
  });
});
