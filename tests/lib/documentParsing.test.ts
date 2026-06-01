import { describe, expect, it } from "@jest/globals";
import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
import {
  DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
  getDocumentParserAdapter,
  parseDocumentText,
} from "@/lib/documentParsing";

const VM0007_TEXT = [
  "1.9  Project Boundary",
  "The project area is defined in this section.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario without the project.",
  "",
  "4.3  Monitoring Plan",
  "The monitoring plan defines the monitoring frequency and responsibilities.",
].join("\n");

describe("documentParsing current extractor adapter", () => {
  it("exposes the current extractor as the default parser adapter", () => {
    expect(getDocumentParserAdapter().id).toBe(DEFAULT_DOCUMENT_PARSER_ADAPTER_ID);
  });

  it("returns the same section and heading extraction as the legacy quick check helpers", () => {
    const parsed = parseDocumentText({ rawText: VM0007_TEXT });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.rawText).toBe(VM0007_TEXT);
    expect(parsed.normalizedText).toBe(VM0007_TEXT);
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        rawText: VM0007_TEXT,
        normalizedText: VM0007_TEXT,
      },
    ]);
    expect(parsed.headings.map((heading) => heading.sectionNumber)).toEqual(["1.9", "2.4", "4.3"]);
    expect(parsed.blocks.some((block) => block.type === "heading")).toBe(true);
    expect(parsed.blocks.some((block) => block.type === "paragraph")).toBe(true);
    expect(parsed.sectionsByNumber).toEqual(extractPddSections(VM0007_TEXT));
    expect(parsed.headingIndex).toEqual(buildPddHeadingIndex(VM0007_TEXT));
    expect(parsed.diagnostics).toEqual({
      metadata: debugSectionExtraction(VM0007_TEXT),
    });
  });

  it("avoids noisy diagnostics for blank input while keeping a stable empty shape", () => {
    const parsed = parseDocumentText({ rawText: "   " });

    expect(parsed.normalizedText).toBe("   ");
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        rawText: "   ",
        normalizedText: "   ",
      },
    ]);
    expect(parsed.blocks).toEqual([]);
    expect(parsed.headings).toEqual([]);
    expect(parsed.sectionsByNumber).toEqual({});
    expect(parsed.headingIndex).toEqual([]);
    expect(parsed.diagnostics).toBeUndefined();
  });
});
