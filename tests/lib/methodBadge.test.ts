import { describe, expect, it } from "@jest/globals";
import { deriveStandard, dirnameFromPath, isSourceAuditedMeta, metaUrlFromRulesPath } from "@/lib/methodBadge";

function makeFullMeta(overrides?: Record<string, unknown>): unknown {
  return {
    artifact_status: { rules: "source_audited", sections: "source_audited", source_pdf: "verified" },
    methodology_linked_review_ready: true,
    methodology_linked_review_blockers: [],
    artifact_quality_standard: { adoption_status: "grade_a" },
    ...overrides,
  };
}

describe("metaUrlFromRulesPath", () => {
  it("returns null for null input", () => {
    expect(metaUrlFromRulesPath(null)).toBeNull();
  });

  it("returns correct META.json path from rules.json", () => {
    expect(metaUrlFromRulesPath("methodologies/Verra/AFOLU/VM0047/v1-0/rules.json"))
      .toBe("methodologies/Verra/AFOLU/VM0047/v1-0/META.json");
  });

  it("preserves a leading slash for root-relative paths", () => {
    expect(metaUrlFromRulesPath("/methodologies/Verra/AFOLU/VM0047/v1-0/rules.json"))
      .toBe("/methodologies/Verra/AFOLU/VM0047/v1-0/META.json");
  });

  it("returns correct META.json path from rules.rich.json", () => {
    expect(metaUrlFromRulesPath("methodologies/Verra/AFOLU/VM0047/v1-0/rules.rich.json"))
      .toBe("methodologies/Verra/AFOLU/VM0047/v1-0/META.json");
  });

  it("returns null for a bare filename with no parent directory", () => {
    expect(metaUrlFromRulesPath("rules.json")).toBeNull();
  });
});

describe("dirnameFromPath", () => {
  it("strips the last segment", () => {
    expect(dirnameFromPath("a/b/c")).toBe("a/b");
  });

  it("returns empty string for a bare filename", () => {
    expect(dirnameFromPath("rules.json")).toBe("");
  });

  it("returns root slash for top-level path", () => {
    expect(dirnameFromPath("/rules.json")).toBe("/");
  });
});

describe("deriveStandard", () => {
  it("returns UNFCCC for UNFCCC", () => {
    expect(deriveStandard("UNFCCC")).toBe("UNFCCC");
  });

  it("returns Verra for VCS", () => {
    expect(deriveStandard("VCS")).toBe("Verra");
  });

  it("returns Verra for Verra", () => {
    expect(deriveStandard("Verra")).toBe("Verra");
  });

  it("returns Gold Standard for GS", () => {
    expect(deriveStandard("GS")).toBe("Gold Standard");
  });

  it("returns Gold Standard for Gold Standard", () => {
    expect(deriveStandard("Gold Standard")).toBe("Gold Standard");
  });

  it("returns Gold Standard for GoldStandard (no space)", () => {
    expect(deriveStandard("GoldStandard")).toBe("Gold Standard");
  });

  it("returns Gold Standard for goldstandard (lowercase, no space)", () => {
    expect(deriveStandard("goldstandard")).toBe("Gold Standard");
  });

  it("returns Gold Standard for gold-standard", () => {
    expect(deriveStandard("gold-standard")).toBe("Gold Standard");
  });

  it("passes unknown programs through unchanged", () => {
    expect(deriveStandard("Other")).toBe("Other");
  });
});

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
