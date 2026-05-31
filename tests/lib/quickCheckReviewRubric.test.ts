import { describe, expect, it } from "@jest/globals";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";

const STRONG_RIGHT_OF_USE_PDD = [
  "1.11  Compliance with Laws, Statutes and Other Regulatory Frameworks",
  "The project complies with applicable laws and regulatory frameworks and holds the required permits.",
  "",
  "1.12.1  Right of Use",
  "The project proponent has legal authority and right of use to manage the project area.",
  "Land and resource use rights are documented through a concession agreement and land title registration.",
  "",
].join("\n");

const WEAK_RIGHT_OF_USE_PDD = [
  "1.12.1  Right of Use",
  "The project describes right of use for the project area.",
  "",
].join("\n");

const STRONG_STAKEHOLDER_PDD = [
  "6  Stakeholder Comments",
  "Stakeholder consultation and participation were conducted through community meetings and workshops.",
  "Local communities and stakeholder representatives were consulted.",
  "Comments and feedback were summarized and addressed in the project response matrix.",
  "",
].join("\n");

const WEAK_STAKEHOLDER_PDD = [
  "6  Stakeholder Comments",
  "Stakeholder comments are presented in this section.",
  "",
].join("\n");

describe("review-area rubrics — right_of_use", () => {
  it("returns supported when legal authority, compliance, and documentary support are all present", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD demonstrate legal right of use for the project area?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: STRONG_RIGHT_OF_USE_PDD,
    });

    expect(result.reviewArea).toBe("right_of_use");
    expect(result.reviewAreaReview).toEqual(expect.objectContaining({
      review_area: "right_of_use",
      verdict: "supported",
    }));
    expect(result.reviewAreaReview?.cited_sections).toEqual(expect.arrayContaining(["1.11", "1.12.1"]));
    expect(result.reviewAreaReview?.gaps).toEqual([]);
  });

  it("returns partial when a right-of-use section is found but documentary and compliance evidence are weak", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD demonstrate legal right of use for the project area?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: WEAK_RIGHT_OF_USE_PDD,
    });

    expect(result.relevantSections).toEqual(["1.12.1"]);
    expect(result.reviewAreaReview).toEqual(expect.objectContaining({
      review_area: "right_of_use",
      verdict: "partial",
      cited_sections: ["1.12.1"],
    }));
    expect(result.reviewAreaReview?.gaps).toContain(
      "No clear legal or regulatory compliance basis was found for the claimed right of use.",
    );
    expect(result.reviewAreaReview?.gaps).toContain(
      "No documentary basis such as a title, lease, concession, agreement, or registration was found in the matched text.",
    );
  });

  it("distinguishes section found from evidence sufficient for right_of_use", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does the PDD explain ownership or use rights for the project area?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: WEAK_RIGHT_OF_USE_PDD,
    });

    expect(result.matchedHeadings.length).toBeGreaterThan(0);
    expect(result.reviewAreaReview?.verdict).not.toBe("supported");
  });
});

describe("review-area rubrics — stakeholder", () => {
  it("returns supported when consultation activity, participants, and feedback handling are all present", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe stakeholder consultation and participation?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: STRONG_STAKEHOLDER_PDD,
    });

    expect(result.reviewArea).toBe("stakeholder");
    expect(result.reviewAreaReview).toEqual(expect.objectContaining({
      review_area: "stakeholder",
      verdict: "supported",
      cited_sections: ["6"],
    }));
    expect(result.reviewAreaReview?.gaps).toEqual([]);
  });

  it("returns partial when a stakeholder section is found but consultation evidence is weak", () => {
    const result = buildReviewQuestionResult({
      claimText: "Were local communities consulted?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: WEAK_STAKEHOLDER_PDD,
    });

    expect(result.relevantSections).toEqual(["6"]);
    expect(result.reviewAreaReview).toEqual(expect.objectContaining({
      review_area: "stakeholder",
      verdict: "partial",
      cited_sections: ["6"],
    }));
    expect(result.reviewAreaReview?.gaps).toContain(
      "No clear consultation, engagement, or participation activity was found in the matched section text.",
    );
    expect(result.reviewAreaReview?.gaps).toContain(
      "No clear identification of who was consulted was found in the matched text.",
    );
  });

  it("distinguishes section found from evidence sufficient for stakeholder", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD explain stakeholder engagement?",
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: WEAK_STAKEHOLDER_PDD,
    });

    expect(result.matchedHeadings.length).toBeGreaterThan(0);
    expect(result.reviewAreaReview?.verdict).not.toBe("supported");
  });
});
