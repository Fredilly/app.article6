import { describe, expect, it } from "@jest/globals";
import { extractPddSections, extractSectionContent } from "@/lib/chat/quickCheckSectionExtractor";

const VM0007_PDD_TEXT = [
  "1.10  Leakage",
  "The leakage belt for this project is determined by the following criteria.",
  "A 3 km buffer around the project area is used.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario in the absence of the project activity.",
  "The project area consists of degraded grassland.",
  "Without the project, the grassland would remain degraded.",
  "",
  "2.5  Additionality",
  "The project is additional because it faces barriers to implementation.",
  "A barrier analysis is provided in the following paragraphs.",
  "The investment analysis shows the project is not financially viable without carbon revenue.",
  "",
  "1.10.1  Leakage Mitigation",
  "Mitigation measures include fire management and grazing control.",
  "",
].join("\n");

describe("extractPddSections", () => {
  it("extracts section 2.4 (Baseline Scenario) from VM0007 PDD text", () => {
    const sections = extractPddSections(VM0007_PDD_TEXT);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("baseline scenario");
    expect(sections["2.4"]).toContain("degraded grassland");
  });

  it("extracts section 2.5 (Additionality) from VM0007 PDD text", () => {
    const sections = extractPddSections(VM0007_PDD_TEXT);
    expect(sections["2.5"]).toBeDefined();
    expect(sections["2.5"]).toContain("barrier analysis");
    expect(sections["2.5"]).toContain("investment analysis");
  });

  it("extracts section 1.10 (Leakage) from VM0007 PDD text", () => {
    const sections = extractPddSections(VM0007_PDD_TEXT);
    expect(sections["1.10"]).toBeDefined();
    expect(sections["1.10"]).toContain("leakage belt");
    expect(sections["1.10"]).toContain("3 km buffer");
  });

  it("returns undefined for a section that does not exist in the text", () => {
    const sections = extractPddSections(VM0007_PDD_TEXT);
    expect(sections["3.3"]).toBeUndefined();
  });

  it("does not confuse sub-sections with parent sections", () => {
    const sections = extractPddSections(VM0007_PDD_TEXT);
    expect(sections["1.10"]).toBeDefined();
    expect(sections["1.10.1"]).toBeDefined();
    expect(sections["1.10"]).not.toContain("Mitigation");
    expect(sections["1.10.1"]).toContain("Mitigation");
  });

  it("returns an empty object for empty text", () => {
    expect(extractPddSections("")).toEqual({});
  });

  it("returns an empty object for text with no section headings", () => {
    expect(extractPddSections("Some random text without any section numbers.")).toEqual({});
  });
});

describe("extractSectionContent", () => {
  it("returns content for an existing section", () => {
    const content = extractSectionContent(VM0007_PDD_TEXT, "2.4");
    expect(content).not.toBeNull();
    expect(content).toContain("most likely land-use scenario");
  });

  it("returns null for a section that does not exist", () => {
    expect(extractSectionContent(VM0007_PDD_TEXT, "1.9")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(extractSectionContent("", "2.4")).toBeNull();
  });

  it("preserves the heading text in the extracted content", () => {
    const content = extractSectionContent(VM0007_PDD_TEXT, "2.5");
    expect(content).toContain("Additionality");
  });
});
