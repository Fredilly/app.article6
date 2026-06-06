import { describe, expect, test } from "@jest/globals";
import { buildDocumentStructure } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import {
  compileEvidenceDocument,
  compileEvidenceDocumentFromStructure,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { extractDocumentFacts } from "@/lib/quickCheck/evidence/extractDocumentFacts";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";

const SAMPLE_TEXT = [
  "Katingan Peatland Restoration and Conservation Project",
  "",
  "Table of Contents",
  "1 Project Details ........ 2",
  "",
  "1 Project Details",
  "Host country: Indonesia",
  "Project location: Central Kalimantan, Indonesia",
  "Project participants: PT Rimba Makmur Utama; Permian Global",
  "Methodology: VM0007 REDD+ Methodology Framework (v1.6)",
  "Crediting period: 01 January 2021 to 31 December 2030",
  "Reporting period: 01 January 2024 to 31 December 2024",
  "Monitoring period: 01 January 2024 to 31 December 2024",
  "Leakage value: 0 tCO2e",
  "",
  "2 Baseline Scenario",
  "Baseline scenario: Conversion of peat swamp forest to plantations without project intervention.",
  "",
  "3 Additionality",
  "The project is additional because investment barriers and land-use pressure would otherwise prevent conservation.",
  "",
  "Page 1 of 10",
].join("\n");

describe("compileEvidenceDocument", () => {
  test("builds canonical spans with section context", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-1",
      rawText: SAMPLE_TEXT,
    });

    expect(compiled.spans.some((span) => span.blockType === "title")).toBe(true);
    expect(compiled.spans.some((span) => span.blockType === "toc")).toBe(true);
    expect(compiled.spans.some((span) => span.blockType === "footer")).toBe(true);
    expect(compiled.spans.some((span) => span.blockType === "section_heading" && span.sectionId === "1")).toBe(true);
    expect(compiled.spans.some((span) => span.blockType === "field" && span.heading === "Project Details")).toBe(true);
  });

  test("adapts DocumentStructure into the evidence compiler with provenance intact", () => {
    const parsedDocument = parseDocumentText({ rawText: SAMPLE_TEXT });
    const documentStructure = buildDocumentStructure({ parsedDocument });

    const compiled = compileEvidenceDocumentFromStructure({
      docId: "doc-structure-1",
      documentStructure,
    });

    expect(compiled.rawText).toBe(SAMPLE_TEXT);
    expect(compiled.spans.some((span) => span.page === 1)).toBe(true);
    expect(compiled.spans.some((span) => span.blockType === "section_heading")).toBe(true);
    expect(compiled.spans.some((span) => span.sectionId === "section:1")).toBe(true);
    expect(compiled.spans.some((span) => span.heading === "Project Details")).toBe(true);
  });

  test("keeps a leading numbered section heading out of the title slot", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-2",
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
      ].join("\n"),
    });

    expect(compiled.spans[0]).toEqual(
      expect.objectContaining({
        blockType: "section_heading",
        sectionId: "1",
        heading: "Project Details",
        text: "1 Project Details",
      }),
    );
    expect(compiled.spans.some((span) => span.blockType === "title")).toBe(false);
    expect(compiled.spans[1]).toEqual(
      expect.objectContaining({
        blockType: "field",
        heading: "Project Details",
        text: "Host country: Indonesia",
      }),
    );
  });
});

describe("extractDocumentFacts", () => {
  test("extracts deterministic facts with span provenance", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-1",
      rawText: SAMPLE_TEXT,
    });

    const facts = extractDocumentFacts(compiled);

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "project_title", value: "Katingan Peatland Restoration and Conservation Project" }),
        expect.objectContaining({ kind: "host_country", value: "Indonesia", confidence: "high" }),
        expect.objectContaining({ kind: "methodology", value: "VM0007 REDD+ Methodology Framework (v1.6)" }),
        expect.objectContaining({ kind: "crediting_period", value: "01 January 2021 to 31 December 2030" }),
        expect.objectContaining({
          kind: "baseline_scenario",
          value: expect.stringContaining("Baseline scenario: Conversion of peat swamp forest to plantations"),
        }),
      ]),
    );

    expect(facts.every((fact) => fact.evidenceSpanIds.length > 0)).toBe(true);
  });

  test("does not extract labeled facts from mid-sentence prose mentions", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-3",
      rawText: [
        "Project narrative",
        "",
        "The host country: Indonesia is referenced in the narrative but not declared as a labeled field.",
      ].join("\n"),
    });

    const facts = extractDocumentFacts(compiled);
    expect(facts.some((fact) => fact.kind === "host_country")).toBe(false);
  });
});

describe("validateQuotes", () => {
  test("validates exact and normalized quotes against compiled spans", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-1",
      rawText: SAMPLE_TEXT,
    });

    const [exact, normalized, missing] = validateQuotes(compiled, [
      { quote: "Host country: Indonesia" },
      { quote: "the project is additional because investment barriers and land-use pressure would otherwise prevent conservation" },
      { quote: "This sentence is not in the document." },
    ]);

    expect(exact).toEqual(expect.objectContaining({ valid: true, matchType: "exact", confidence: "high" }));
    expect(normalized).toEqual(expect.objectContaining({ valid: true, matchType: "normalized", confidence: "medium" }));
    expect(missing).toEqual(expect.objectContaining({ valid: false, matchType: "missing" }));
  });
});
