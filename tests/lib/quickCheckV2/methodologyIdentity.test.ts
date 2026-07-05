import { describe, expect, it } from "@jest/globals";
import { buildQuickCheckMethodologyIdentity } from "@/lib/quickCheckV2/methodologyIdentity";

describe("buildQuickCheckMethodologyIdentity", () => {
  it("keeps the raw document wording in evidenceQuote while canonicalizing the version", () => {
    const identity = buildQuickCheckMethodologyIdentity({
      sourceType: "fact_contract",
      quote: "  ACM0002: “Consolidated baseline methodology for grid-connected electricity generation from renewable sources” (version 4).  ",
      page: 8,
      sectionHeading: "Title and reference of the approved baseline methodology applied to the project activity:",
      sectionPath: ["B", "B.1"],
      spanId: "synthetic:p8:b0",
    });

    expect(identity).not.toBeNull();
    expect(identity?.pddDeclaredMethodologyVersion).toBe("v4.0");
    expect(identity?.evidenceQuote).toBe(
      "  ACM0002: “Consolidated baseline methodology for grid-connected electricity generation from renewable sources” (version 4).  ",
    );
  });
});
