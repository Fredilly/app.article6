import { describe, expect, it } from "@jest/globals";
import { validateReview } from "@/lib/verify/reviewValidation";

describe("reviewValidation", () => {
  it("allows pending reviews without rationale or support reference", () => {
    expect(
      validateReview({
        status: "pending",
        rationale: "",
        supportReference: "",
      }),
    ).toHaveLength(0);
  });

  it("requires rationale and support reference for non-pending states", () => {
    const errors = validateReview({
      status: "verified",
      rationale: "  ",
      supportReference: "",
    });

    expect(errors).toEqual([
      {
        field: "rationale",
        message: "Rationale is required when status is not Pending",
      },
      {
        field: "supportReference",
        message: "Support reference is required when status is not Pending",
      },
    ]);
  });
});
