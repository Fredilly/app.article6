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

  it("extracts the primary methodology row and normalizes a bare table version", () => {
    const identity = buildQuickCheckMethodologyIdentity({
      sourceType: "exact_section",
      quote: "Methodology VM0007 VM0007 REDD+ Methodology Framework (REDD+MF) 1.8",
      page: 83,
      sectionHeading: "Title and Reference of Methodology (VCS, 3.1)",
      sectionPath: ["3", "3.1", "3.1.1"],
      spanId: "synthetic:p83:b0",
    });

    expect(identity).not.toBeNull();
    expect(identity?.methodologyId).toBe("VM0007");
    expect(identity?.methodologyName).toBe("REDD+ Methodology Framework");
    expect(identity?.methodologyAlias).toBe("REDD+MF");
    expect(identity?.pddDeclaredMethodologyVersion).toBe("v1.8");
    expect(identity?.versionStatus).toBe("DECLARED");
    expect(identity?.evidenceQuote).toBe(
      "Methodology VM0007 VM0007 REDD+ Methodology Framework (REDD+MF) 1.8",
    );
  });
});
