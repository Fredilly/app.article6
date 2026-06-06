import { describe, expect, test } from "@jest/globals";
import { compileEvidenceDocument } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
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
  function factByKind(text: string, kind: string) {
    const compiled = compileEvidenceDocument({ docId: `doc-${kind}`, rawText: text });
    return extractDocumentFacts(compiled).find((fact) => fact.kind === kind);
  }

  test("extracts project title from the title span", () => {
    expect(factByKind(SAMPLE_TEXT, "project_title")).toEqual(
      expect.objectContaining({ kind: "project_title", value: "Katingan Peatland Restoration and Conservation Project" }),
    );
  });

  test("does not use a numbered section heading as project title", () => {
    expect(factByKind(["1 Project Details", "Host country: Indonesia"].join("\n"), "project_title")).toBeUndefined();
  });

  test("extracts host country and host party wording", () => {
    expect(factByKind(["Project Title", "Host country: Indonesia"].join("\n"), "host_country")).toEqual(
      expect.objectContaining({ value: "Indonesia" }),
    );
    expect(factByKind(["Project Title", "Host party: Ghana"].join("\n"), "host_country")).toEqual(
      expect.objectContaining({ value: "Ghana" }),
    );
  });

  test("extracts project location", () => {
    expect(factByKind(["Project Title", "Project location: Central Kalimantan, Indonesia"].join("\n"), "project_location")).toEqual(
      expect.objectContaining({ value: "Central Kalimantan, Indonesia" }),
    );
  });

  test("extracts crediting period", () => {
    expect(factByKind(["Project Title", "Crediting period: 2021 to 2030"].join("\n"), "crediting_period")).toEqual(
      expect.objectContaining({ value: "2021 to 2030" }),
    );
  });

  test("extracts reporting period only when explicitly present", () => {
    expect(factByKind(["Project Title", "Reporting period: 2024 to 2025"].join("\n"), "reporting_period")).toEqual(
      expect.objectContaining({ value: "2024 to 2025" }),
    );
  });

  test("does not hallucinate reporting period when only crediting period exists", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-crediting-only",
      rawText: ["Project Title", "Crediting period: 2021 to 2030"].join("\n"),
    });
    const facts = extractDocumentFacts(compiled);
    expect(facts.find((fact) => fact.kind === "crediting_period")).toEqual(expect.objectContaining({ value: "2021 to 2030" }));
    expect(facts.find((fact) => fact.kind === "reporting_period")).toBeUndefined();
    expect(facts.find((fact) => fact.kind === "monitoring_period")).toBeUndefined();
  });

  test("monitoring period stays absent when only reporting period exists", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-reporting-only",
      rawText: ["Project Title", "Reporting period: 2024 to 2025"].join("\n"),
    });
    const facts = extractDocumentFacts(compiled);
    expect(facts.find((fact) => fact.kind === "reporting_period")).toEqual(expect.objectContaining({ value: "2024 to 2025" }));
    expect(facts.find((fact) => fact.kind === "monitoring_period")).toBeUndefined();
  });

  test("extracts monitoring period when explicitly present", () => {
    expect(factByKind(["Project Title", "Monitoring period: 2024 to 2025"].join("\n"), "monitoring_period")).toEqual(
      expect.objectContaining({ value: "2024 to 2025" }),
    );
  });

  test("extracts baseline methodology separately from monitoring methodology", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-methodologies",
      rawText: [
        "Project Title",
        "Applied methodology: VM0007 Version 1.0",
        "Monitoring methodology: ACM0002 Version 02.0",
      ].join("\n"),
    });
    const facts = extractDocumentFacts(compiled);
    expect(facts.find((fact) => fact.kind === "baseline_methodology")).toEqual(
      expect.objectContaining({ value: "VM0007 Version 1.0" }),
    );
    expect(facts.find((fact) => fact.kind === "monitoring_methodology")).toEqual(
      expect.objectContaining({ value: "ACM0002 Version 02.0" }),
    );
  });

  test("extracts monitoring methodology from a CDM-style D.1 heading", () => {
    const compiled = compileEvidenceDocument({
      docId: "doc-monitoring-heading",
      rawText: [
        "Project Title",
        "D.1 Name and reference of approved monitoring methodology applied",
        "",
        "ACM0002 Version 02.0",
      ].join("\n"),
    });
    expect(extractDocumentFacts(compiled).find((fact) => fact.kind === "monitoring_methodology")).toEqual(
      expect.objectContaining({ value: "ACM0002 Version 02.0" }),
    );
  });

  test("extracts a leakage statement, not only leakage value", () => {
    expect(
      factByKind(
        ["Project Title", "Leakage statement: Leakage is not expected because activities remain within the existing management boundary."].join("\n"),
        "leakage_statement",
      ),
    ).toEqual(expect.objectContaining({ value: "Leakage is not expected because activities remain within the existing management boundary" }));
  });

  test("every extracted fact has at least one valid evidenceSpanId", () => {
    const compiled = compileEvidenceDocument({ docId: "doc-all", rawText: SAMPLE_TEXT });
    const facts = extractDocumentFacts(compiled);
    expect(facts.length).toBeGreaterThan(0);
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
