import { describe, expect, it } from "@jest/globals";
import {
  getFallbackStages,
  getPreferredSectionBoosts,
  getReviewAreaKeywords,
  getReviewAreaPolicy,
  getSemanticSignals,
  getTitlePenalties,
  isVm0007StylePdd,
  shouldExpandAncestors,
  REVIEW_POLICY_CONFIG,
} from "@/lib/quickCheck/policy/reviewPolicy";
import type { ReviewArea } from "@/lib/quickCheck/retrieval/types";

const REVIEW_AREAS: ReviewArea[] = [
  "additionality",
  "baseline",
  "boundary",
  "deviations",
  "leakage",
  "monitoring",
  "right_of_use",
  "stakeholder",
  "general",
];

describe("quickCheck review policy", () => {
  it("defines a policy entry for every review area", () => {
    expect(Object.keys(REVIEW_POLICY_CONFIG.reviewAreas).sort()).toEqual([...REVIEW_AREAS].sort());

    for (const reviewArea of REVIEW_AREAS) {
      expect(getReviewAreaPolicy(reviewArea)).toBeDefined();
    }
  });

  it("keeps the fallback stage order stable", () => {
    expect(getFallbackStages()).toEqual([
      "exact_heading",
      "normalized_heading",
      "alias_heading",
      "semantic_fallback",
    ]);
  });

  it("applies vm0007 extra keywords only for vm0007-style inputs", () => {
    const nonVm0007Keywords = getReviewAreaKeywords({
      reviewArea: "right_of_use",
      methodologyId: "VCS-OTHER",
    });
    const vm0007MethodKeywords = getReviewAreaKeywords({
      reviewArea: "right_of_use",
      methodologyId: "VM0007",
    });
    const vm0007RawTextKeywords = getReviewAreaKeywords({
      reviewArea: "right_of_use",
      methodologyId: "VCS-OTHER",
      rawPddText: "Project Description Document for PD_REDD_v1_130",
    });

    expect(nonVm0007Keywords).not.toContain("compliance with laws statutes and other regulatory frameworks");
    expect(vm0007MethodKeywords).toContain("compliance with laws statutes and other regulatory frameworks");
    expect(vm0007RawTextKeywords).toContain("compliance with laws statutes and other regulatory frameworks");
  });

  it("detects vm0007-style pdds from methodology id or raw text only", () => {
    expect(isVm0007StylePdd("VM0007")).toBe(true);
    expect(isVm0007StylePdd("pd_redd_v1_130")).toBe(true);
    expect(isVm0007StylePdd("other-method", "This PDD follows PD_REDD_v1_130 guidance.")).toBe(true);
    expect(isVm0007StylePdd("other-method", "Generic methodology document")).toBe(false);
  });

  it("exposes monitoring boosts, penalties, and ancestor expansion through helpers", () => {
    expect(getPreferredSectionBoosts("monitoring")).toEqual([
      {
        sectionNumber: "4.3",
        titleIncludes: "monitoring plan",
        score: 16,
      },
    ]);
    expect(getTitlePenalties("monitoring")).toEqual([
      {
        titleIncludes: "monitoring equipment",
        unlessTitleIncludes: "monitoring plan",
        score: 10,
      },
    ]);
    expect(shouldExpandAncestors("monitoring")).toBe(true);
    expect(shouldExpandAncestors("baseline")).toBe(false);
  });

  it("exposes stakeholder evidence signals through helpers", () => {
    expect(getSemanticSignals("stakeholder")).toEqual([
      "fpic",
      "free prior and informed consent",
      "grievance procedure",
      "community meetings",
      "project awareness",
    ]);
  });
});
