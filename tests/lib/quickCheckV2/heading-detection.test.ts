import { describe, it, expect } from "@jest/globals";
import { parseExtractedText } from "@/lib/quickCheckV2/ingestion";

// ---------------------------------------------------------------------------
// Synthetic heading patterns — tests that the regex handles heading styles
// not present in the Envira fixture (this avoids coupling regex tests to a
// specific document).
// ---------------------------------------------------------------------------

describe("Quick Check v2 — heading detection (synthetic text)", () => {
  it('detects "1. Project Details" as heading with sectionPath ["1"]', () => {
    const text = "1. Project Details\nSome body content here.\n2. Baseline\nMore body.";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find(
      (b) => b.text === "1. Project Details",
    );
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["1"]);
  });

  it('detects "1 Project Details" (no dot) as heading with sectionPath ["1"]', () => {
    const text = "1 Project Details\nSome body content here.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "1 Project Details");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["1"]);
  });

  it('detects "2. Baseline" as heading with sectionPath ["2"]', () => {
    const text = "1. Project Details\nMore stuff.\n2. Baseline\nBaseline content.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "2. Baseline");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["2"]);
  });

  it('detects "2 Baseline" (no dot) as heading with sectionPath ["2"]', () => {
    const text = "1 Project Details\nMore stuff.\n2 Baseline\nBaseline data.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "2 Baseline");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["2"]);
  });

  it('detects "3. Additionality" as heading with sectionPath ["3"]', () => {
    const text = "2. Baseline\nData.\n3. Additionality\nAdditionality analysis.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "3. Additionality");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["3"]);
  });

  it('detects "3 Additionality" (no dot) as heading with sectionPath ["3"]', () => {
    const text = "2 Baseline\nData.\n3 Additionality\nAdditionality analysis.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "3 Additionality");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["3"]);
  });

  it("body blocks inherit the correct section path after a top-level heading", () => {
    const text = "1. Project Details\nDescription of the project.\n2. Baseline\nBaseline scenario data.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const bodyBlocks = doc.blocks.filter((b) => b.blockType === "body");
    // First body should be under section 1
    expect(bodyBlocks[0]!.sectionPath).toEqual(["1"]);
    // Second body should be under section 2
    expect(bodyBlocks[1]!.sectionPath).toEqual(["2"]);
  });

  it("still detects existing all-caps top-level headings", () => {
    const text = "1 PROJECT DETAILS\nContent.\n5 ENVIRONMENTAL IMPACT\nImpact data.\n6 STAKEHOLDER COMMENTS\nComments.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading1 = doc.blocks.find((b) => b.text === "1 PROJECT DETAILS");
    expect(heading1).toBeDefined();
    expect(heading1!.blockType).toBe("heading");
    const heading5 = doc.blocks.find((b) => b.text === "5 ENVIRONMENTAL IMPACT");
    expect(heading5).toBeDefined();
    expect(heading5!.blockType).toBe("heading");
    const heading6 = doc.blocks.find((b) => b.text === "6 STAKEHOLDER COMMENTS");
    expect(heading6).toBeDefined();
    expect(heading6!.blockType).toBe("heading");
  });

  it('detects subsection headings like "2.4.2 Monitoring Plan"', () => {
    const text = "2.4.2 Monitoring Plan\nThe monitoring plan details.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "2.4.2 Monitoring Plan");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["2", "2.4", "2.4.2"]);
  });

  it('detects "A.1 Annex Section" style headings', () => {
    const text = "A.1 Annex Details\nAnnex content.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "A.1 Annex Details");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    // "A.1" is a dotted decimal, so sectionPath builds ["A", "A.1"]
    expect(heading!.sectionPath).toEqual(["A", "A.1"]);
  });

  it('detects "Annex 1" style headings', () => {
    const text = "Annex 1\nAnnex content.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "Annex 1");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["annex-1"]);
  });

  it('detects "Appendix A" style headings', () => {
    const text = "Appendix A\nAppendix content.\n";
    const doc = parseExtractedText(text, "synthetic", "test");
    const heading = doc.blocks.find((b) => b.text === "Appendix A");
    expect(heading).toBeDefined();
    expect(heading!.blockType).toBe("heading");
    expect(heading!.sectionPath).toEqual(["appendix-a"]);
  });

  describe("bare numeric lines are not headings or page markers", () => {
    it('bare "0" is body, not heading', () => {
      // "Title" makes a first-line heading so "0" is evaluated normally
      const text = "Title\n0\nSome content after zero.\n";
      const doc = parseExtractedText(text, "synthetic", "test");
      const zeroBlock = doc.blocks.find((b) => b.text === "0");
      expect(zeroBlock).toBeDefined();
      expect(zeroBlock!.blockType).not.toBe("heading");
    });

    it('bare "1" is body, not heading', () => {
      const text = "Title\n1\nSome content after one.\n";
      const doc = parseExtractedText(text, "synthetic", "test");
      const oneBlock = doc.blocks.find((b) => b.text === "1");
      expect(oneBlock).toBeDefined();
      expect(oneBlock!.blockType).not.toBe("heading");
    });

    it('bare "25" is body, not heading', () => {
      const text = "Title\n25\nSome content.\n";
      const doc = parseExtractedText(text, "synthetic", "test");
      const block = doc.blocks.find((b) => b.text === "25");
      expect(block).toBeDefined();
      expect(block!.blockType).not.toBe("heading");
    });

    it('bare "100" is body, not heading', () => {
      const text = "Title\n100\nMore data.\n";
      const doc = parseExtractedText(text, "synthetic", "test");
      const block = doc.blocks.find((b) => b.text === "100");
      expect(block).toBeDefined();
      expect(block!.blockType).not.toBe("heading");
    });
  });
});
