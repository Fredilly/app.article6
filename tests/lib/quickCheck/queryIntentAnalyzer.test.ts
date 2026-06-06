import { describe, expect, test } from "@jest/globals";
import { buildSectionTableIndex } from "@/lib/quickCheck/indexing";
import { analyzeQueryIntent } from "@/lib/quickCheck/queryIntent";
import {
  loadProjectFactFixtureManifest,
  runProjectFactFixturePipeline,
} from "./projectFactContractFixtureHarness";

function buildFixtureIndex(fixtureId: string) {
  const manifest = loadProjectFactFixtureManifest();
  const fixture = manifest.fixtures.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Expected fixture "${fixtureId}" in project fact manifest.`);
  }
  const { structure, evidence } = runProjectFactFixturePipeline(fixture);
  return buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });
}

describe("Query intent analyzer", () => {
  test("maps table questions to tables and cells for explicit table evidence", () => {
    const result = analyzeQueryIntent({
      query: "What does the table say about net ghg removals?",
      sectionTableIndex: {
        documentFamily: "REDD_AFOLU",
        sectionTree: {
          roots: [],
          orderedNodeIds: [],
          nodesById: {},
        },
        sectionTopicMap: {
          baseline: [],
          monitoring: [],
          leakage: [],
          additionality: [],
          methodology: [],
          project_location: [],
          project_participants: [],
          crediting_period: [],
          safeguards: [],
          sdg: [],
        },
        tableIndex: {
          tables: [{
            evidenceSpanId: "span:table:1",
            tableId: "table-1",
            sectionId: "section:appendix",
            sectionPath: ["section:appendix"],
            heading: "Net GHG removals table",
            headingPath: ["Appendix", "Net GHG removals table"],
            pageNumbers: [1],
            rowCount: 2,
            columnCount: 2,
            confidence: 0.88,
            limitedProvenance: false,
            cells: [{
              evidenceSpanId: "span:table:1",
              sourceTableId: "table-1",
              sourceBlockId: "block:table:1",
              rowIndex: 0,
              columnIndex: 1,
              text: "Net GHG removals",
              normalizedText: "net ghg removals",
              sectionPath: ["section:appendix"],
              headingPath: ["Appendix", "Net GHG removals table"],
              confidence: 0.88,
              limitedProvenance: false,
            }],
          }],
          cells: [],
          byEvidenceSpanId: {},
          byTableId: {},
        },
      },
    });

    expect(result.intent).toBe("table_lookup");
    expect(result.targetTables).toEqual(["table-1"]);
    expect(result.targetCells.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test("maps fact lookup queries to ProjectFactContract fact ids", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "What is the project title and host country?",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("fact_lookup");
    expect(result.targetFacts).toEqual(expect.arrayContaining(["projectTitle", "hostCountry"]));
    expect(result.targetSections).toEqual([]);
    expect(result.unsupportedTopic).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test("maps lettered section references to explicit section ids", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "What does section B.5 say about monitoring?",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("section_topic");
    expect(result.targetSections.some((sectionId) => sectionId.includes("B.5"))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test("maps section-topic queries to family-backed sections", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "Explain the baseline scenario.",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("section_topic");
    expect(result.targetSections.length).toBeGreaterThan(0);
    expect(result.positiveTerms).toContain("baseline scenario");
    expect(result.calculationSpecific).toBe(false);
  });

  test("maps methodology questions to methodology lookup intent", () => {
    const index = buildFixtureIndex("more-real-envira");
    const result = analyzeQueryIntent({
      query: "What methodology is used for this project?",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("methodology_lookup");
    expect(result.targetFacts).toEqual(expect.arrayContaining(["methodologyPrimary", "methodologyModules"]));
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test("flags baseline calculation-specific queries", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "Calculate the baseline emissions formula for the project.",
      sectionTableIndex: index,
    });

    expect(result.calculationSpecific).toBe(true);
    expect(["section_topic", "table_lookup", "methodology_lookup", "ambiguous"]).toContain(result.intent);
  });

  test("returns unsupported_or_out_of_scope for unsupported topics", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "What is the stock price of the project developer?",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("unsupported_or_out_of_scope");
    expect(result.unsupportedTopic).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test("flags ambiguous queries instead of forced promotion", () => {
    const index = buildFixtureIndex("real-cdm");
    const result = analyzeQueryIntent({
      query: "Tell me about the baseline and methodology.",
      sectionTableIndex: index,
    });

    expect(result.intent).toBe("ambiguous");
    expect(result.targetFacts.length).toBe(0);
    expect(result.targetSections.length).toBe(0);
    expect(result.confidence).toBeLessThan(0.6);
  });

  test("keeps weak unknown-family queries safe", () => {
    const index = buildFixtureIndex("more-real-weak");
    const result = analyzeQueryIntent({
      query: "What is the monitoring period?",
      sectionTableIndex: index,
    });

    expect(index.documentFamily).toBe("UNKNOWN");
    expect(["unsupported_or_out_of_scope", "ambiguous", "fact_lookup"]).toContain(result.intent);
    if (result.intent === "fact_lookup") {
      expect(result.confidence).toBeLessThan(0.85);
    }
  });
});
