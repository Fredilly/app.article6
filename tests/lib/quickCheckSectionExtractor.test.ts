import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  extractPddSections,
  extractSectionContent,
  extractRoutedSections,
  normalizeSectionKey,
  SECTION_EXCERPT_MAX_CHARS,
} from "@/lib/chat/quickCheckSectionExtractor";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";

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

const REALISTIC_PDD_TEXT = [
  "VM0007 Version 1.1",
  "Project Description Document",
  "",
  "Page 1 of 42",
  "",
  "1.9  Project Boundary",
  "The project area is located in the central region.",
  "Geographic coordinates are provided in the annex.",
  "The leakage belt extends 3 km from the project boundary.",
  "",
  "Page 2 of 42",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario",
  "in the absence of the project activity. The project area",
  "consists of degraded grassland that has been subject to",
  "overgrazing for the past decade.",
  "",
  "Page 3 of 42",
  "VM0007 Version 1.1",
  "",
  "2.5  Additionality",
  "The project is additional because it faces significant",
  "barriers to implementation. A barrier analysis is provided",
  "in the following paragraphs.",
  "",
].join("\n");

const WRAPPED_HEADING_TEXT = [
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario",
  "in the absence of the project activity.",
  "",
  "a) Sub-section one",
  "This is a sub-section that could be confused with a heading.",
  "b) Sub-section two",
  "This is another sub-section.",
  "",
].join("\n");

const NO_SECTION_TEXT = "This is a plain document with no section headings whatsoever.";

const EXACT_RAW_LINES_TEXT = [
  "VM0007 Version 1.1",
  "Project Description Document",
  "",
  "Page 1 of 42",
  "",
  "1.1  Project Background",
  "This project is a reforestation activity in the central highlands.",
  "",
  "Page 2 of 42",
  "",
  "1.9  Project Boundary",
  "The project area is located in the central region of the country.",
  "",
  "v1.1",
  "",
  "2.3  Carbon Pools",
  "Above-ground biomass, below-ground biomass.",
  "",
  "Page 3 of 42",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario in the",
  "absence of the project activity. The project area consists of",
  "degraded grassland that has been subject to overgrazing for the",
  "past decade. Without the project, carbon stocks would continue",
  "to decline.",
  "",
  "VM0007 Version 1.1",
  "",
  "2.5  Additionality",
  "The project is additional because it faces significant barriers",
  "to implementation. A barrier analysis is provided in the",
  "following paragraphs. The investment analysis demonstrates that",
  "the project is not financially viable without carbon revenue.",
  "",
  "Page 4 of 42",
  "",
  "2.6  Deviations",
  "No deviations from the methodology are proposed.",
  "",
  "1.10  Leakage",
  "The leakage belt for this project is determined using the",
  "default 3 km buffer approach as specified in VM0007.",
  "Activity shifting leakage is expected to be minimal.",
  "",
  "3.3  Monitoring",
  "Monitoring will be conducted annually using permanent sample",
  "plots. A total of 50 plots are established across the project",
  "area.",
].join("\n");

const SPLIT_HEADING_TEXT = [
  "Some introductory text.",
  "",
  "2.4",
  "Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario",
  "in the absence of the project activity.",
  "",
  "2.5",
  "Additionality",
  "The project is additional and faces barriers to implementation.",
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

  it("handles realistic PDD text with page breaks and header/footer noise", () => {
    const sections = extractPddSections(REALISTIC_PDD_TEXT);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("degraded grassland");
    expect(sections["2.4"]).not.toContain("VM0007 Version 1.1");
    expect(sections["2.5"]).toBeDefined();
    expect(sections["2.5"]).toContain("barrier analysis");
  });

  it("extracts section 1.9 from realistic PDD text with header/footer noise", () => {
    const sections = extractPddSections(REALISTIC_PDD_TEXT);
    expect(sections["1.9"]).toBeDefined();
    expect(sections["1.9"]).toContain("project area");
    expect(sections["1.9"]).not.toContain("Page 1 of 42");
  });

  it("does not confuse lettered sub-sections (a), b)) with section headings", () => {
    const sections = extractPddSections(WRAPPED_HEADING_TEXT);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("Sub-section one");
    expect(sections["2.4"]).toContain("Sub-section two");
    expect(Object.keys(sections)).not.toContain("a");
    expect(Object.keys(sections)).not.toContain("b");
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
    expect(extractPddSections(NO_SECTION_TEXT)).toEqual({});
  });

  it("handles split headings where number and title are on separate lines", () => {
    const sections = extractPddSections(SPLIT_HEADING_TEXT);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("Baseline Scenario");
    expect(sections["2.4"]).toContain("most likely land-use scenario");
    expect(sections["2.5"]).toBeDefined();
    expect(sections["2.5"]).toContain("Additionality");
    expect(sections["2.5"]).toContain("barriers to implementation");
  });

  it("strips page break characters before parsing", () => {
    const text = "2.4  Baseline Scenario\fSome content after page break.\fMore content.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toContain("page break");
    expect(sections["2.4"]).toContain("More content");
  });

  it("applies excerpt limit to prevent overflow", () => {
    const longBody = "Word. ".repeat(SECTION_EXCERPT_MAX_CHARS);
    const text = `2.4  Baseline Scenario\n${longBody}`;
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]!.length).toBeLessThan(SECTION_EXCERPT_MAX_CHARS + 200);
    expect(sections["2.4"]).toMatch(/\[…\]$/);
  });
});

describe("normalizeSectionKey", () => {
  it("passes through a clean section key unchanged", () => {
    expect(normalizeSectionKey("2.4")).toBe("2.4");
  });

  it("strips trailing punctuation after the section number", () => {
    expect(normalizeSectionKey("2.4.")).toBe("2.4");
    expect(normalizeSectionKey("2.4:")).toBe("2.4");
  });

  it("removes whitespace inside the section number", () => {
    expect(normalizeSectionKey("2 . 4")).toBe("2.4");
    expect(normalizeSectionKey("2 .4")).toBe("2.4");
    expect(normalizeSectionKey("2. 4")).toBe("2.4");
  });

  it("strips title text after the number", () => {
    expect(normalizeSectionKey("2.4 (Baseline Scenario)")).toBe("2.4");
    expect(normalizeSectionKey("2.4 Baseline Scenario")).toBe("2.4");
  });

  it("handles sub-section numbers", () => {
    expect(normalizeSectionKey("1.10")).toBe("1.10");
    expect(normalizeSectionKey("1.10.1")).toBe("1.10.1");
    expect(normalizeSectionKey("1.12.1.")).toBe("1.12.1");
  });
});

describe("heading format variations", () => {
  it("extracts section with dot after number: 2.4. Title", () => {
    const text = "2.4. Baseline Scenario\nThe baseline scenario text.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("baseline scenario text");
  });

  it("extracts section with title in parentheses: 2.4 (Title)", () => {
    const text = "2.4 (Baseline Scenario)\nThe baseline scenario text.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("baseline scenario text");
  });

  it("extracts section with a single space between number and title", () => {
    const text = "2.4 Baseline Scenario\nThe baseline scenario text.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("baseline scenario text");
  });

  it("extracts section with colon after number: 2.4: Title", () => {
    const text = "2.4: Baseline Scenario\nThe baseline scenario text.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("baseline scenario text");
  });
});

describe("lookup normalization", () => {
  it("extractSectionContent finds section with normalized key", () => {
    const text = "2.4. Baseline Scenario\nSome content.";
    const content = extractSectionContent(text, "2.4");
    expect(content).not.toBeNull();
    expect(content).toContain("Some content");
  });

  it("extractRoutedSections finds section with normalized key", () => {
    const text = "2.5. Additionality\nSome additionality content.";
    const result = extractRoutedSections(text, ["2.5"]);
    expect(result["2.5"]).toBeDefined();
    expect(result["2.5"]).toContain("additionality content");
  });
});

describe("continuous text (whitespace-collapsed, no line breaks)", () => {
  it("extracts sections from continuous text that mimics heuristic PDF fallback output", () => {
    const text = "VM0007 Version 1.1 Project Description Document Page 1 of 42 1.1 Project Background This project is a reforestation activity. Page 2 of 42 2.4 Baseline Scenario The baseline scenario is the most likely land-use scenario in the absence of the project activity. The project area consists of degraded grassland. 2.5 Additionality The project is additional because it faces significant barriers to implementation. 1.10 Leakage The leakage belt for this project is determined using the default 3 km buffer approach.";
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.5"]).toBeDefined();
    expect(sections["1.10"]).toBeDefined();
    expect(sections["2.4"]).toContain("most likely land-use scenario");
    expect(sections["2.5"]).toContain("barriers to implementation");
    expect(sections["1.10"]).toContain("3 km buffer");
  });

  it("extracts all three baseline sections from continuous text via buildReviewQuestionResult", () => {
    const text = "2.4 Baseline Scenario The baseline scenario is the most likely land-use scenario. 2.5 Additionality The project is additional. 1.10 Leakage The leakage belt is determined.";
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD support the baseline scenario under VM0007?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: text,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.5"]).toBeDefined();
    expect(result.sectionContent["1.10"]).toBeDefined();
  });
});

describe("exact raw lines from fixture", () => {
  const text = EXACT_RAW_LINES_TEXT;

  it("extracts section 2.4 from exact fixture raw lines (line 26)", () => {
    const sections = extractPddSections(text);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.4"]).toContain("most likely land-use scenario");
    expect(sections["2.4"]).toContain("overgrazing");
    expect(sections["2.4"]).toContain("carbon stocks");
  });

  it("extracts section 2.5 from exact fixture raw lines (line 35)", () => {
    const sections = extractPddSections(text);
    expect(sections["2.5"]).toBeDefined();
    expect(sections["2.5"]).toContain("barrier analysis");
    expect(sections["2.5"]).toContain("investment analysis");
    expect(sections["2.5"]).toContain("carbon revenue");
  });

  it("extracts section 1.10 from exact fixture raw lines (line 46)", () => {
    const sections = extractPddSections(text);
    expect(sections["1.10"]).toBeDefined();
    expect(sections["1.10"]).toContain("leakage belt");
    expect(sections["1.10"]).toContain("3 km buffer");
    expect(sections["1.10"]).toContain("Activity shifting");
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

  it("extracts from realistic PDD text with noise", () => {
    const content = extractSectionContent(REALISTIC_PDD_TEXT, "2.4");
    expect(content).not.toBeNull();
    expect(content).toContain("overgrazing");
    expect(content).not.toContain("Page 3 of 42");
  });
});

describe("extractRoutedSections", () => {
  it("extracts only the requested sections in a single pass", () => {
    const result = extractRoutedSections(VM0007_PDD_TEXT, ["2.4", "2.5"]);
    expect(Object.keys(result)).toEqual(["2.4", "2.5"]);
    expect(result["2.4"]).toContain("degraded grassland");
    expect(result["2.5"]).toContain("barrier analysis");
    expect(result["1.10"]).toBeUndefined();
  });

  it("returns empty object when none of the requested sections exist", () => {
    const result = extractRoutedSections(VM0007_PDD_TEXT, ["9.9", "10.1"]);
    expect(result).toEqual({});
  });

  it("returns empty object for empty relevant sections", () => {
    const result = extractRoutedSections(VM0007_PDD_TEXT, []);
    expect(result).toEqual({});
  });

  it("works with realistic noisy PDD text", () => {
    const result = extractRoutedSections(REALISTIC_PDD_TEXT, ["1.9", "2.4"]);
    expect(result["1.9"]).toContain("project area");
    expect(result["2.4"]).toContain("overgrazing");
    expect(result["1.9"]).not.toContain("Page 2 of 42");
  });
});

describe("fixture-based regression — real extracted PDD text format", () => {
  const fixturePath = path.join(__dirname, "..", "fixtures", "quick-check", "vm0007-pdd-extracted.txt");
  const fixtureText = fs.readFileSync(fixturePath, "utf-8");

  it("extracts sections 2.4, 2.5, and 1.10 from the fixture", () => {
    const sections = extractPddSections(fixtureText);
    expect(sections["2.4"]).toBeDefined();
    expect(sections["2.5"]).toBeDefined();
    expect(sections["1.10"]).toBeDefined();
  });

  it("extracts section 2.4 (Baseline) content from the fixture", () => {
    const sections = extractPddSections(fixtureText);
    expect(sections["2.4"]).toContain("most likely land-use scenario");
  });

  it("extracts section 2.5 (Additionality) content from the fixture", () => {
    const sections = extractPddSections(fixtureText);
    expect(sections["2.5"]).toContain("barrier analysis");
    expect(sections["2.5"]).toContain("investment analysis");
  });

  it("extracts section 1.10 (Leakage) content from the fixture", () => {
    const sections = extractPddSections(fixtureText);
    expect(sections["1.10"]).toContain("leakage belt");
    expect(sections["1.10"]).toContain("3 km buffer");
  });

  it("routes and extracts all baseline sections from fixture via buildReviewQuestionResult", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD support the baseline scenario under VM0007?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: fixtureText,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.5"]).toBeDefined();
    expect(result.sectionContent["1.10"]).toBeDefined();
    expect(result.sectionContent["2.4"]).toContain("overgrazing");
    expect(result.sectionContent["2.5"]).toContain("carbon revenue");
    expect(result.sectionContent["1.10"]).toContain("3 km buffer");
  });

  it("strips header/footer noise from fixture-extracted section content", () => {
    const sections = extractPddSections(fixtureText);
    expect(sections["2.4"]).not.toContain("VM0007 Version");
    expect(sections["2.5"]).not.toContain("Page 4 of 42");
    expect(sections["1.10"]).not.toContain("v1.1");
  });
});
