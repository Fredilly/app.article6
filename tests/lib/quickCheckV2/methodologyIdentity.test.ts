import { describe, expect, it } from "@jest/globals";
import {
  buildQuickCheckMethodologyIdentity,
  buildQuickCheckMethodologyIdentityFromDocument,
} from "@/lib/quickCheckV2/methodologyIdentity";

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

  it("uses an empty methodology alias when no alias exists", () => {
    const identity = buildQuickCheckMethodologyIdentity({
      sourceType: "fact_contract",
      quote: "VM0007 REDD Methodology Modules Version 1.5",
      page: 31,
      sectionHeading: "Title and Reference of Methodology",
      sectionPath: ["2", "2.1"],
      spanId: "synthetic:p31:b0",
    });

    expect(identity?.methodologyAlias).toBe("");
  });

  it("falls back to the full extracted document when the evidence quote omits the declared version", () => {
    const identity = buildQuickCheckMethodologyIdentityFromDocument(
      {
        documentId: "synthetic-doc",
        parser: "test",
        blocks: [
          {
            spanId: "synthetic-doc:p1:b0",
            page: 1,
            text: "Methodology VM0007 REDD Methodology Modules",
            blockType: "body",
            sectionHeading: "Title and Reference of Methodology",
            sectionPath: ["2", "2.1"],
            source: "primary",
          },
          {
            spanId: "synthetic-doc:p2:b0",
            page: 2,
            text: "Methodology VM0007 REDD Methodology Modules Version 1.5",
            blockType: "body",
            sectionHeading: "Title and Reference of Methodology",
            sectionPath: ["2", "2.1"],
            source: "primary",
          },
        ],
        diagnostics: { warnings: [] },
      },
      {
        sourceType: "fact_contract",
        quote: "Methodology VM0007 REDD Methodology Modules",
        page: 1,
        sectionHeading: "Title and Reference of Methodology",
        sectionPath: ["2", "2.1"],
        spanId: "synthetic-doc:p1:b0",
      },
    );

    expect(identity?.pddDeclaredMethodologyVersion).toBe("v1.5");
    expect(identity?.versionStatus).toBe("DECLARED");
  });
});
