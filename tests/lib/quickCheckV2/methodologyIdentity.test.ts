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

  it("stops generic methodology parsing before module text in a long methodology row", () => {
    const identity = buildQuickCheckMethodologyIdentity({
      sourceType: "fact_contract",
      quote: "Applied Methodology VM0007 REDD+ Methodology Framework (REDD+MF) (Avoided Planned Deforestation) 1.8 Module VMD0001 Estimation of carbon stocks in the above- and below-ground biomass in live trees and non-tree pools 1.2 Module VMD0011 Estimation of emissions from market leakage (LK- ME) 1.2",
      page: 61,
      sectionHeading: "Title and Reference of Methodology (VCS, 3.1)",
      sectionPath: ["3", "3.1", "3.1.1"],
      spanId: "synthetic:p61:b1",
    });

    expect(identity).not.toBeNull();
    expect(identity).toStrictEqual({
      methodologyId: "VM0007",
      methodologyName: "REDD+ Methodology Framework",
      methodologyAlias: "REDD+MF",
      pddDeclaredMethodologyVersion: "v1.8",
      versionStatus: "DECLARED",
      evidencePage: 61,
      evidenceSection: "Title and Reference of Methodology (VCS, 3.1)",
      evidenceQuote: "Applied Methodology VM0007 REDD+ Methodology Framework (REDD+MF) (Avoided Planned Deforestation) 1.8 Module VMD0001 Estimation of carbon stocks in the above- and below-ground biomass in live trees and non-tree pools 1.2 Module VMD0011 Estimation of emissions from market leakage (LK- ME) 1.2",
    });
  });

  it("builds the primary identity from hybrid methodology evidence without special casing the codes", () => {
    const identity = buildQuickCheckMethodologyIdentity({
      sourceType: "exact_section",
      quote: "The project utilizes VM0048 Reducing Emissions from Deforestation and Forest Degradation Version 1.0 (VM0048, Reducing Emissions from Deforestation and Degradation, v1.0 (verra.org)) in instances where it is materially applicable and employs VM0007 REDD+ Methodology Framework (REDD-MF) where VM0048 is not materially applicable. Methodology VM0048 VM0048 Reducing Emissions from Deforestation and Forest Degradation 1.0 Methodology VM0007 VM0007 REDD+ Methodology Framework (REDD-MF) 1.8",
      page: 82,
      sectionHeading: "Title and Reference of Methodology (VCS, 3.1)",
      sectionPath: ["3", "3.1", "3.1.1"],
      spanId: "synthetic:p82:b0",
    });

    expect(identity).not.toBeNull();
    expect(identity?.methodologyId).toBe("VM0048");
    expect(identity?.methodologyName).toContain("Reducing Emissions from Deforestation and Forest Degradation");
    expect(identity?.pddDeclaredMethodologyVersion).toBe("v1.0");
    expect(identity?.versionStatus).toBe("DECLARED");
  });
});
