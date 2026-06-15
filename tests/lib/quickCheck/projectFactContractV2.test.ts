import { describe, expect, test } from "@jest/globals";
import type { DocumentStructure } from "@/lib/documentModel";
import {
  compileEvidenceDocumentFromStructure,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";

function makeStructure(overrides: Partial<DocumentStructure>): DocumentStructure {
  return {
    id: "article6-document:test",
    source: "test-parser",
    parserAdapterId: "current-extractor",
    rawText: overrides.rawText ?? "",
    cleanText: overrides.cleanText ?? "",
    matchingText: overrides.matchingText ?? "",
    documentFamily: overrides.documentFamily ?? {
      family: "UNKNOWN",
      confidence: 0.2,
      evidence: [],
      signals: [],
      warnings: [],
    },
    qualityReport: overrides.qualityReport ?? {
      parserName: "test-parser",
      warnings: [],
      sourceContentMode: "unknown",
      pageCount: 1,
      textDensity: 0.25,
      ocrConfidence: undefined,
      tableHeavyWarning: false,
      layoutHeavyWarning: false,
      headersFootersDetected: false,
      weakExtractionWarning: false,
      hasStructuredHeadings: true,
      hasPageBoundaries: false,
      hasBoundingBoxes: false,
      hasTables: false,
    },
    pages: overrides.pages ?? [],
    blocks: overrides.blocks ?? [],
    sections: overrides.sections ?? [],
    extractionWarnings: overrides.extractionWarnings ?? [],
    parserDiagnostics: overrides.parserDiagnostics,
    debug: overrides.debug,
  };
}

function compileContract(docId: string, documentStructure: DocumentStructure) {
  return buildProjectFactContract(compileEvidenceDocumentFromStructure({ docId, documentStructure }));
}

describe("ProjectFactContract v2", () => {
  test("extracts core CDM project facts with provenance", () => {
    const rawText = [
      "Rural Nepal Biogas Activity",
      "A.1 General description of project activity",
      "Host country: Nepal",
      "Applied baseline methodology: AMS-III.R. Methane recovery in agricultural activities at household/small farm level",
      "Crediting period: 01 January 2021 to 31 December 2028",
      "B.4 Baseline Scenario",
      "Baseline scenario: continued non-renewable biomass use in rural households.",
    ].join("\n");

    const contract = compileContract("cdm-contract", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "CDM_PDD",
        confidence: 0.96,
        evidence: ["CDM"],
        signals: [],
        warnings: [],
      },
      sections: [
        {
          id: "section:A.1",
          sectionNumber: "A.1",
          titleRaw: "General description of project activity",
          titleClean: "General description of project activity",
          titleMatchingText: "general description of project activity",
          bodyRaw: "Host country: Nepal\nApplied baseline methodology: AMS-III.R. Methane recovery in agricultural activities at household/small farm level\nCrediting period: 01 January 2021 to 31 December 2028",
          bodyClean: "Host country: Nepal Applied baseline methodology: AMS-III.R. Methane recovery in agricultural activities at household/small farm level Crediting period: 01 January 2021 to 31 December 2028",
          bodyMatchingText: "host country: nepal applied baseline methodology: ams-iii.r. methane recovery in agricultural activities at household/small farm level crediting period: 01 january 2021 to 31 december 2028",
          displaySnippet: "Host country: Nepal",
          matchingText: "general description of project activity host country: nepal",
          childIds: [],
          blockIds: ["title-1", "field-1", "field-2", "field-3"],
          sourceRefs: [],
          confidence: 0.95,
          extractionWarnings: [],
        },
        {
          id: "section:B.4",
          sectionNumber: "B.4",
          titleRaw: "Baseline Scenario",
          titleClean: "Baseline Scenario",
          titleMatchingText: "baseline scenario",
          bodyRaw: "Baseline scenario: continued non-renewable biomass use in rural households.",
          bodyClean: "Baseline scenario: continued non-renewable biomass use in rural households.",
          bodyMatchingText: "baseline scenario: continued non-renewable biomass use in rural households.",
          displaySnippet: "Baseline scenario: continued non-renewable biomass use in rural households.",
          matchingText: "baseline scenario continued non-renewable biomass use in rural households.",
          childIds: [],
          blockIds: ["section-2", "paragraph-2"],
          sourceRefs: [],
          confidence: 0.95,
          extractionWarnings: [],
        },
      ],
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1", "section-1", "field-1", "field-2", "field-3", "section-2", "paragraph-2"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "Rural Nepal Biogas Activity",
          cleanText: "Rural Nepal Biogas Activity",
          matchingText: "rural nepal biogas activity",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.98,
        },
        {
          id: "section-1",
          type: "heading",
          rawText: "A.1 General description of project activity",
          cleanText: "A.1 General description of project activity",
          matchingText: "a.1 general description of project activity",
          pageNumber: 1,
          sectionId: "section:A.1",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-1",
          type: "paragraph",
          rawText: "Host country: Nepal",
          cleanText: "Host country: Nepal",
          matchingText: "host country: nepal",
          pageNumber: 1,
          sectionId: "section:A.1",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-2",
          type: "paragraph",
          rawText: "Applied baseline methodology: AMS-III.R. Methane recovery in agricultural activities at household/small farm level",
          cleanText: "Applied baseline methodology: AMS-III.R. Methane recovery in agricultural activities at household/small farm level",
          matchingText: "applied baseline methodology: ams-iii.r. methane recovery in agricultural activities at household/small farm level",
          pageNumber: 1,
          sectionId: "section:A.1",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-3",
          type: "paragraph",
          rawText: "Crediting period: 01 January 2021 to 31 December 2028",
          cleanText: "Crediting period: 01 January 2021 to 31 December 2028",
          matchingText: "crediting period: 01 january 2021 to 31 december 2028",
          pageNumber: 1,
          sectionId: "section:A.1",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "section-2",
          type: "heading",
          rawText: "B.4 Baseline Scenario",
          cleanText: "B.4 Baseline Scenario",
          matchingText: "b.4 baseline scenario",
          pageNumber: 1,
          sectionId: "section:B.4",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "paragraph-2",
          type: "paragraph",
          rawText: "Baseline scenario: continued non-renewable biomass use in rural households.",
          cleanText: "Baseline scenario: continued non-renewable biomass use in rural households.",
          matchingText: "baseline scenario: continued non-renewable biomass use in rural households.",
          pageNumber: 1,
          sectionId: "section:B.4",
          sourceRefs: [],
          confidence: 0.9,
        },
      ],
    }));

    expect(contract.documentFamily).toBe("CDM_PDD");
    expect(contract.documentType).toBe("PROJECT_DESIGN_DOCUMENT");
    expect(contract.projectTitle.value).toBe("Rural Nepal Biogas Activity");
    expect(contract.hostCountry.value).toBe("Nepal");
    expect(contract.projectCountry.value).toBe("Nepal");
    expect(contract.projectStandard.value).toBe("CDM");
    expect(contract.methodologyPrimary.value).toContain("AMS-III.R");
    expect(contract.creditingPeriod.value).toBe("01 January 2021 to 31 December 2028");
    expect(contract.baselineSections.value).toEqual(["Baseline Scenario"]);
    expect(contract.methodologyPrimary.evidenceSpanIds.length).toBeGreaterThan(0);
    expect(contract.methodologyPrimary.pageNumbers).toEqual([1]);
    expect(contract.methodologyPrimary.sectionPath).toContain("section:A.1");
    expect(contract.methodologyPrimary.extractionRule).toBe("label:methodologyPrimary");
    expect(contract.methodologyPrimary.family).toBe("CDM_PDD");
    expect(contract.methodologyPrimary.sourceParser).toBe("test-parser");
  });

  test("extracts core Verra/VCS project facts without confusing title and methodology", () => {
    const rawText = [
      "Katingan Peatland Restoration and Conservation Project",
      "Project Description",
      "Country/Area: Indonesia",
      "Project proponent: PT Rimba Makmur Utama",
      "Title and reference of methodology applied: VM0007 REDD+ Methodology Framework v1.6",
      "Reporting period: 01 January 2024 to 31 December 2024",
      "Monitoring period: 01 January 2023 to 31 December 2023",
    ].join("\n");

    const contract = compileContract("verra-contract", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "VERRA_PD",
        confidence: 0.95,
        evidence: ["Verra VCS"],
        signals: [],
        warnings: [],
      },
      sections: [{
        id: "section:project-description",
        titleRaw: "Project Description",
        titleClean: "Project Description",
        titleMatchingText: "project description",
        bodyRaw: "Country/Area: Indonesia\nProject proponent: PT Rimba Makmur Utama\nTitle and reference of methodology applied: VM0007 REDD+ Methodology Framework v1.6\nReporting period: 01 January 2024 to 31 December 2024\nMonitoring period: 01 January 2023 to 31 December 2023",
        bodyClean: "Country/Area: Indonesia Project proponent: PT Rimba Makmur Utama Title and reference of methodology applied: VM0007 REDD+ Methodology Framework v1.6 Reporting period: 01 January 2024 to 31 December 2024 Monitoring period: 01 January 2023 to 31 December 2023",
        bodyMatchingText: "country/area: indonesia project proponent: pt rimba makmur utama title and reference of methodology applied: vm0007 redd+ methodology framework v1.6 reporting period: 01 january 2024 to 31 december 2024 monitoring period: 01 january 2023 to 31 december 2023",
        displaySnippet: "Country/Area: Indonesia",
        matchingText: "project description country/area: indonesia",
        childIds: [],
        blockIds: ["title-1", "section-1", "field-1", "field-2", "field-3", "field-4", "field-5"],
        sourceRefs: [],
        confidence: 0.95,
        extractionWarnings: [],
      }],
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1", "section-1", "field-1", "field-2", "field-3", "field-4", "field-5"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "Katingan Peatland Restoration and Conservation Project",
          cleanText: "Katingan Peatland Restoration and Conservation Project",
          matchingText: "katingan peatland restoration and conservation project",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.98,
        },
        {
          id: "section-1",
          type: "heading",
          rawText: "Project Description",
          cleanText: "Project Description",
          matchingText: "project description",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-1",
          type: "paragraph",
          rawText: "Country/Area: Indonesia",
          cleanText: "Country/Area: Indonesia",
          matchingText: "country/area: indonesia",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-2",
          type: "paragraph",
          rawText: "Project proponent: PT Rimba Makmur Utama",
          cleanText: "Project proponent: PT Rimba Makmur Utama",
          matchingText: "project proponent: pt rimba makmur utama",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-3",
          type: "paragraph",
          rawText: "Title and reference of methodology applied: VM0007 REDD+ Methodology Framework v1.6",
          cleanText: "Title and reference of methodology applied: VM0007 REDD+ Methodology Framework v1.6",
          matchingText: "title and reference of methodology applied: vm0007 redd+ methodology framework v1.6",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-4",
          type: "paragraph",
          rawText: "Reporting period: 01 January 2024 to 31 December 2024",
          cleanText: "Reporting period: 01 January 2024 to 31 December 2024",
          matchingText: "reporting period: 01 january 2024 to 31 december 2024",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-5",
          type: "paragraph",
          rawText: "Monitoring period: 01 January 2023 to 31 December 2023",
          cleanText: "Monitoring period: 01 January 2023 to 31 December 2023",
          matchingText: "monitoring period: 01 january 2023 to 31 december 2023",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
      ],
    }));

    expect(contract.documentFamily).toBe("VERRA_PD");
    expect(contract.documentType).toBe("PROJECT_DESCRIPTION");
    expect(contract.projectTitle.value).toBe("Katingan Peatland Restoration and Conservation Project");
    expect(contract.projectTitle.value).not.toContain("VM0007");
    expect(contract.hostCountry.value).toBe("Indonesia");
    expect(contract.projectCountry.value).toBe("Indonesia");
    expect(contract.projectStandard.value).toBe("Verra VCS");
    expect(contract.projectProponent.value).toBe("PT Rimba Makmur Utama");
    expect(contract.methodologyPrimary.value).toContain("VM0007");
    expect(contract.reportingPeriod.value).toBe("01 January 2024 to 31 December 2024");
    expect(contract.monitoringPeriod.value).toBe("01 January 2023 to 31 December 2023");
    expect(contract.reportingPeriod.value).not.toBe(contract.monitoringPeriod.value);
  });

  test("returns unclear facts instead of guessing when evidence is weak", () => {
    const rawText = [
      "VM0007 REDD+ Methodology Framework v1.6",
      "This document summarizes methodology context only.",
    ].join("\n");

    const contract = compileContract("unclear-contract", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "UNKNOWN",
        confidence: 0.25,
        evidence: [],
        signals: [],
        warnings: ["Document family remained UNKNOWN because deterministic intake signals were insufficient."],
      },
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1", "paragraph-1"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "VM0007 REDD+ Methodology Framework v1.6",
          cleanText: "VM0007 REDD+ Methodology Framework v1.6",
          matchingText: "vm0007 redd+ methodology framework v1.6",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "paragraph-1",
          type: "paragraph",
          rawText: "This document summarizes methodology context only.",
          cleanText: "This document summarizes methodology context only.",
          matchingText: "this document summarizes methodology context only.",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.7,
        },
      ],
    }));

    expect(contract.projectTitle.value).toBeNull();
    expect(contract.hostCountry.value).toBeNull();
    expect(contract.methodologyPrimary.value).toBeNull();
    expect(contract.projectTitle.warnings.join(" ")).toContain("No deterministic evidence found");
    expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
  });

  test("detects conflicting fact values and surfaces warnings", () => {
    const rawText = [
      "Forest Conservation Project",
      "Host country: Indonesia",
      "Host country: Peru",
    ].join("\n");

    const contract = compileContract("conflict-contract", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "VCS_PD",
        confidence: 0.8,
        evidence: ["VCS"],
        signals: [],
        warnings: [],
      },
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1", "field-1", "field-2"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "Forest Conservation Project",
          cleanText: "Forest Conservation Project",
          matchingText: "forest conservation project",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-1",
          type: "paragraph",
          rawText: "Host country: Indonesia",
          cleanText: "Host country: Indonesia",
          matchingText: "host country: indonesia",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "field-2",
          type: "paragraph",
          rawText: "Host country: Peru",
          cleanText: "Host country: Peru",
          matchingText: "host country: peru",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
      ],
    }));

    expect(contract.hostCountry.value).toBeNull();
    expect(contract.hostCountry.warnings.join(" ")).toContain("Conflicting values detected");
    expect(contract.hostCountry.evidenceSpanIds).toHaveLength(2);
    expect(contract.warnings.some((warning) => warning.includes("Conflicting values detected"))).toBe(true);
  });

  test("derives project country from leading country value when location lists country before subregion", () => {
    const rawText = "Project Location Indonesia, Central Kalimantan";

    const contract = compileContract("location-country-order", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "VERRA_PD",
        confidence: 0.9,
        evidence: ["Verra"],
        signals: [],
        warnings: [],
      },
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "Project Location Indonesia, Central Kalimantan",
          cleanText: "Project Location Indonesia, Central Kalimantan",
          matchingText: "project location indonesia, central kalimantan",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
      ],
    }));

    expect(contract.projectLocation.value).toBe("Indonesia, Central Kalimantan");
    expect(contract.projectCountry.value).toBe("Indonesia");
  });

  test("derives project country from trailing country value when location lists subregion before country", () => {
    const rawText = "Project Location Central Kalimantan Province, Indonesia";

    const contract = compileContract("location-country-trailing", makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "VERRA_PD",
        confidence: 0.9,
        evidence: ["Verra"],
        signals: [],
        warnings: [],
      },
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title-1"],
        sourceRefs: [],
      }],
      blocks: [
        {
          id: "title-1",
          type: "heading",
          rawText: "Project Location Central Kalimantan Province, Indonesia",
          cleanText: "Project Location Central Kalimantan Province, Indonesia",
          matchingText: "project location central kalimantan province, indonesia",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
      ],
    }));

    expect(contract.projectLocation.value).toBe("Central Kalimantan Province, Indonesia");
    expect(contract.projectCountry.value).toBe("Indonesia");
  });
});
