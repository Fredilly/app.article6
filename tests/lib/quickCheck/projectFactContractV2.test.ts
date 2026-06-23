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

  describe("Phase 2 family-aware host country extraction", () => {
    test("rejects country match from methodology section", () => {
      const rawText = [
        "Forest Conservation Project",
        "B.1 Methodology",
        "The methodology ACM0002 was approved in Indonesia for similar projects.",
        "Country: Indonesia",
      ].join("\n");

      const contract = compileContract("methodology-country", makeStructure({
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
            id: "section:B.1",
            sectionNumber: "B.1",
            titleRaw: "Methodology",
            titleClean: "Methodology",
            titleMatchingText: "methodology",
            bodyRaw: "The methodology ACM0002 was approved in Indonesia for similar projects. Country: Indonesia",
            bodyClean: "The methodology ACM0002 was approved in Indonesia for similar projects. Country: Indonesia",
            bodyMatchingText: "the methodology acm0002 was approved in indonesia for similar projects. country: indonesia",
            displaySnippet: "The methodology ACM0002 was approved in Indonesia",
            matchingText: "methodology the methodology acm0002 was approved in indonesia",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
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
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "B.1 Methodology",
            cleanText: "B.1 Methodology",
            matchingText: "b.1 methodology",
            pageNumber: 1,
            sectionId: "section:B.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "The methodology ACM0002 was approved in Indonesia for similar projects.",
            cleanText: "The methodology ACM0002 was approved in Indonesia for similar projects.",
            matchingText: "the methodology acm0002 was approved in indonesia for similar projects.",
            pageNumber: 1,
            sectionId: "section:B.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Country: Indonesia",
            cleanText: "Country: Indonesia",
            matchingText: "country: indonesia",
            pageNumber: 1,
            sectionId: "section:B.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("rejects country match from baseline scenario section", () => {
      const rawText = [
        "Renewable Energy Project",
        "B.4 Baseline Scenario",
        "The baseline scenario assumes continued use of coal-fired power plants in China.",
        "Host country: China",
      ].join("\n");

      const contract = compileContract("baseline-country", makeStructure({
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
            id: "section:B.4",
            sectionNumber: "B.4",
            titleRaw: "Baseline Scenario",
            titleClean: "Baseline Scenario",
            titleMatchingText: "baseline scenario",
            bodyRaw: "The baseline scenario assumes continued use of coal-fired power plants in China. Host country: China",
            bodyClean: "The baseline scenario assumes continued use of coal-fired power plants in China. Host country: China",
            bodyMatchingText: "the baseline scenario assumes continued use of coal-fired power plants in china. host country: china",
            displaySnippet: "The baseline scenario assumes continued use",
            matchingText: "baseline scenario the baseline scenario assumes continued use",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Renewable Energy Project",
            cleanText: "Renewable Energy Project",
            matchingText: "renewable energy project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
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
            id: "paragraph-1",
            type: "paragraph",
            rawText: "The baseline scenario assumes continued use of coal-fired power plants in China.",
            cleanText: "The baseline scenario assumes continued use of coal-fired power plants in China.",
            matchingText: "the baseline scenario assumes continued use of coal-fired power plants in china.",
            pageNumber: 1,
            sectionId: "section:B.4",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Host country: China",
            cleanText: "Host country: China",
            matchingText: "host country: china",
            pageNumber: 1,
            sectionId: "section:B.4",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("rejects country match from monitoring section", () => {
      const rawText = [
        "Solar Power Initiative",
        "D.1 Monitoring Plan",
        "Monitoring stations were installed across Peru to track emissions.",
        "Country: Peru",
      ].join("\n");

      const contract = compileContract("monitoring-country", makeStructure({
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
            id: "section:D.1",
            sectionNumber: "D.1",
            titleRaw: "Monitoring Plan",
            titleClean: "Monitoring Plan",
            titleMatchingText: "monitoring plan",
            bodyRaw: "Monitoring stations were installed across Peru to track emissions. Country: Peru",
            bodyClean: "Monitoring stations were installed across Peru to track emissions. Country: Peru",
            bodyMatchingText: "monitoring stations were installed across peru to track emissions. country: peru",
            displaySnippet: "Monitoring stations were installed across Peru",
            matchingText: "monitoring plan monitoring stations were installed across peru",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Solar Power Initiative",
            cleanText: "Solar Power Initiative",
            matchingText: "solar power initiative",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "D.1 Monitoring Plan",
            cleanText: "D.1 Monitoring Plan",
            matchingText: "d.1 monitoring plan",
            pageNumber: 1,
            sectionId: "section:D.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "Monitoring stations were installed across Peru to track emissions.",
            cleanText: "Monitoring stations were installed across Peru to track emissions.",
            matchingText: "monitoring stations were installed across peru to track emissions.",
            pageNumber: 1,
            sectionId: "section:D.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Country: Peru",
            cleanText: "Country: Peru",
            matchingText: "country: peru",
            pageNumber: 1,
            sectionId: "section:D.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("rejects country match from additionality section", () => {
      const rawText = [
        "Wind Farm Project",
        "B.5 Additionality",
        "Similar projects in Brazil have demonstrated additionality.",
        "Host Party: Brazil",
      ].join("\n");

      const contract = compileContract("additionality-country", makeStructure({
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
            id: "section:B.5",
            sectionNumber: "B.5",
            titleRaw: "Additionality",
            titleClean: "Additionality",
            titleMatchingText: "additionality",
            bodyRaw: "Similar projects in Brazil have demonstrated additionality. Host Party: Brazil",
            bodyClean: "Similar projects in Brazil have demonstrated additionality. Host Party: Brazil",
            bodyMatchingText: "similar projects in brazil have demonstrated additionality. host party: brazil",
            displaySnippet: "Similar projects in Brazil have demonstrated additionality",
            matchingText: "additionality similar projects in brazil",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Wind Farm Project",
            cleanText: "Wind Farm Project",
            matchingText: "wind farm project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "B.5 Additionality",
            cleanText: "B.5 Additionality",
            matchingText: "b.5 additionality",
            pageNumber: 1,
            sectionId: "section:B.5",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "Similar projects in Brazil have demonstrated additionality.",
            cleanText: "Similar projects in Brazil have demonstrated additionality.",
            matchingText: "similar projects in brazil have demonstrated additionality.",
            pageNumber: 1,
            sectionId: "section:B.5",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Host Party: Brazil",
            cleanText: "Host Party: Brazil",
            matchingText: "host party: brazil",
            pageNumber: 1,
            sectionId: "section:B.5",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("rejects country match when value contains methodology code", () => {
      const rawText = [
        "Clean Energy Project",
        "A.1 General description of project activity",
        "Host country: AMS-III.R. Switch from non-renewable biomass",
      ].join("\n");

      const contract = compileContract("methodology-code-country", makeStructure({
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
            bodyRaw: "Host country: AMS-III.R. Switch from non-renewable biomass",
            bodyClean: "Host country: AMS-III.R. Switch from non-renewable biomass",
            bodyMatchingText: "host country: ams-iii.r. switch from non-renewable biomass",
            displaySnippet: "Host country: AMS-III.R.",
            matchingText: "general description of project activity host country: ams-iii.r.",
            childIds: [],
            blockIds: ["section-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Clean Energy Project",
            cleanText: "Clean Energy Project",
            matchingText: "clean energy project",
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
            rawText: "Host country: AMS-III.R. Switch from non-renewable biomass",
            cleanText: "Host country: AMS-III.R. Switch from non-renewable biomass",
            matchingText: "host country: ams-iii.r. switch from non-renewable biomass",
            pageNumber: 1,
            sectionId: "section:A.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("accepts host country only when clearly labeled in project overview section", () => {
      const rawText = [
        "CDM Project Activity 42",
        "A.1 General description of project activity",
        "Host country: India",
        "Applied baseline methodology: ACM0001",
        "B.1 Methodology",
        "ACM0001 was validated in India for landfill gas projects.",
      ].join("\n");

      const contract = compileContract("clear-host-country", makeStructure({
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
            bodyRaw: "Host country: India Applied baseline methodology: ACM0001",
            bodyClean: "Host country: India Applied baseline methodology: ACM0001",
            bodyMatchingText: "host country: india applied baseline methodology: acm0001",
            displaySnippet: "Host country: India",
            matchingText: "general description of project activity host country: india",
            childIds: [],
            blockIds: ["section-1", "field-1", "field-2"],
            sourceRefs: [],
            confidence: 0.95,
            extractionWarnings: [],
          },
          {
            id: "section:B.1",
            sectionNumber: "B.1",
            titleRaw: "Methodology",
            titleClean: "Methodology",
            titleMatchingText: "methodology",
            bodyRaw: "ACM0001 was validated in India for landfill gas projects.",
            bodyClean: "ACM0001 was validated in India for landfill gas projects.",
            bodyMatchingText: "acm0001 was validated in india for landfill gas projects.",
            displaySnippet: "ACM0001 was validated in India",
            matchingText: "methodology acm0001 was validated in india",
            childIds: [],
            blockIds: ["section-2", "paragraph-1"],
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
          blockIds: ["title-1", "section-1", "field-1", "field-2", "section-2", "paragraph-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "CDM Project Activity 42",
            cleanText: "CDM Project Activity 42",
            matchingText: "cdm project activity 42",
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
            rawText: "Host country: India",
            cleanText: "Host country: India",
            matchingText: "host country: india",
            pageNumber: 1,
            sectionId: "section:A.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-2",
            type: "paragraph",
            rawText: "Applied baseline methodology: ACM0001",
            cleanText: "Applied baseline methodology: ACM0001",
            matchingText: "applied baseline methodology: acm0001",
            pageNumber: 1,
            sectionId: "section:A.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "section-2",
            type: "heading",
            rawText: "B.1 Methodology",
            cleanText: "B.1 Methodology",
            matchingText: "b.1 methodology",
            pageNumber: 1,
            sectionId: "section:B.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "ACM0001 was validated in India for landfill gas projects.",
            cleanText: "ACM0001 was validated in India for landfill gas projects.",
            matchingText: "acm0001 was validated in india for landfill gas projects.",
            pageNumber: 1,
            sectionId: "section:B.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBe("India");
      expect(contract.hostCountry.confidence).toBe("high");
      expect(contract.hostCountry.evidenceSpanIds.length).toBeGreaterThan(0);
      expect(contract.hostCountry.pageNumbers).toEqual([1]);
    });

    test("rejects country match from stakeholder comments section", () => {
      const rawText = [
        "Reforestation Project",
        "E.1 Stakeholder Comments",
        "Stakeholders in Kenya raised concerns about water usage.",
        "Host country: Kenya",
      ].join("\n");

      const contract = compileContract("stakeholder-country", makeStructure({
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
            id: "section:E.1",
            sectionNumber: "E.1",
            titleRaw: "Stakeholder Comments",
            titleClean: "Stakeholder Comments",
            titleMatchingText: "stakeholder comments",
            bodyRaw: "Stakeholders in Kenya raised concerns about water usage. Host country: Kenya",
            bodyClean: "Stakeholders in Kenya raised concerns about water usage. Host country: Kenya",
            bodyMatchingText: "stakeholders in kenya raised concerns about water usage. host country: kenya",
            displaySnippet: "Stakeholders in Kenya raised concerns",
            matchingText: "stakeholder comments stakeholders in kenya",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Reforestation Project",
            cleanText: "Reforestation Project",
            matchingText: "reforestation project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "E.1 Stakeholder Comments",
            cleanText: "E.1 Stakeholder Comments",
            matchingText: "e.1 stakeholder comments",
            pageNumber: 1,
            sectionId: "section:E.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "Stakeholders in Kenya raised concerns about water usage.",
            cleanText: "Stakeholders in Kenya raised concerns about water usage.",
            matchingText: "stakeholders in kenya raised concerns about water usage.",
            pageNumber: 1,
            sectionId: "section:E.1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Host country: Kenya",
            cleanText: "Host country: Kenya",
            matchingText: "host country: kenya",
            pageNumber: 1,
            sectionId: "section:E.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
      expect(contract.hostCountry.warnings.join(" ")).toContain("No deterministic evidence found");
    });

    test("rejects country match when value is generic preamble rather than a country name", () => {
      const rawText = [
        "Carbon Offset Initiative",
        "A.1 General description of project activity",
        "Host country: The project is located in a developing nation.",
      ].join("\n");

      const contract = compileContract("preamble-country", makeStructure({
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
            bodyRaw: "Host country: The project is located in a developing nation.",
            bodyClean: "Host country: The project is located in a developing nation.",
            bodyMatchingText: "host country: the project is located in a developing nation.",
            displaySnippet: "Host country: The project is located",
            matchingText: "general description of project activity host country: the project",
            childIds: [],
            blockIds: ["section-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Carbon Offset Initiative",
            cleanText: "Carbon Offset Initiative",
            matchingText: "carbon offset initiative",
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
            rawText: "Host country: The project is located in a developing nation.",
            cleanText: "Host country: The project is located in a developing nation.",
            matchingText: "host country: the project is located in a developing nation.",
            pageNumber: 1,
            sectionId: "section:A.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      // The value starts with "the" which is caught by looksLikeMethodologyOrCountryNoise
      expect(contract.hostCountry.value).toBeNull();
    });

    test("host country provenance is required for every found answer", () => {
      const rawText = [
        "Biogas Project Kenya",
        "A.1 General description of project activity",
        "Host country: Kenya",
      ].join("\n");

      const contract = compileContract("provenance-kenya", makeStructure({
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
            bodyRaw: "Host country: Kenya",
            bodyClean: "Host country: Kenya",
            bodyMatchingText: "host country: kenya",
            displaySnippet: "Host country: Kenya",
            matchingText: "general description of project activity host country: kenya",
            childIds: [],
            blockIds: ["section-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Biogas Project Kenya",
            cleanText: "Biogas Project Kenya",
            matchingText: "biogas project kenya",
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
            rawText: "Host country: Kenya",
            cleanText: "Host country: Kenya",
            matchingText: "host country: kenya",
            pageNumber: 1,
            sectionId: "section:A.1",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBe("Kenya");
      expect(contract.hostCountry.evidenceSpanIds.length).toBeGreaterThan(0);
      expect(contract.hostCountry.pageNumbers.length).toBeGreaterThan(0);
      expect(contract.hostCountry.sectionPath).toContain("section:A.1");
    });

    test("random country mention in appendix should not be accepted as host country", () => {
      const rawText = [
        "Clean Cookstove Project",
        "Appendix A - Reference Projects",
        "Similar projects have been implemented in Uganda and Tanzania.",
        "Country: Uganda",
      ].join("\n");

      const contract = compileContract("appendix-country", makeStructure({
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
            id: "section:appendix-a",
            sectionNumber: "Appendix A",
            titleRaw: "Appendix A - Reference Projects",
            titleClean: "Appendix A - Reference Projects",
            titleMatchingText: "appendix a - reference projects",
            bodyRaw: "Similar projects have been implemented in Uganda and Tanzania. Country: Uganda",
            bodyClean: "Similar projects have been implemented in Uganda and Tanzania. Country: Uganda",
            bodyMatchingText: "similar projects have been implemented in uganda and tanzania. country: uganda",
            displaySnippet: "Similar projects have been implemented",
            matchingText: "appendix a - reference projects similar projects",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Clean Cookstove Project",
            cleanText: "Clean Cookstove Project",
            matchingText: "clean cookstove project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "Appendix A - Reference Projects",
            cleanText: "Appendix A - Reference Projects",
            matchingText: "appendix a - reference projects",
            pageNumber: 1,
            sectionId: "section:appendix-a",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "Similar projects have been implemented in Uganda and Tanzania.",
            cleanText: "Similar projects have been implemented in Uganda and Tanzania.",
            matchingText: "similar projects have been implemented in uganda and tanzania.",
            pageNumber: 1,
            sectionId: "section:appendix-a",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Country: Uganda",
            cleanText: "Country: Uganda",
            matchingText: "country: uganda",
            pageNumber: 1,
            sectionId: "section:appendix-a",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
    });

    test("country from leakage discussion should not be accepted as host country", () => {
      const rawText = [
        "Forest Preservation Project",
        "B.6 Leakage",
        "Activity shifting leakage may occur in neighboring Cambodia.",
        "Host country: Cambodia",
      ].join("\n");

      const contract = compileContract("leakage-country", makeStructure({
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
            id: "section:B.6",
            sectionNumber: "B.6",
            titleRaw: "Leakage",
            titleClean: "Leakage",
            titleMatchingText: "leakage",
            bodyRaw: "Activity shifting leakage may occur in neighboring Cambodia. Host country: Cambodia",
            bodyClean: "Activity shifting leakage may occur in neighboring Cambodia. Host country: Cambodia",
            bodyMatchingText: "activity shifting leakage may occur in neighboring cambodia. host country: cambodia",
            displaySnippet: "Activity shifting leakage may occur",
            matchingText: "leakage activity shifting leakage may occur",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Forest Preservation Project",
            cleanText: "Forest Preservation Project",
            matchingText: "forest preservation project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "B.6 Leakage",
            cleanText: "B.6 Leakage",
            matchingText: "b.6 leakage",
            pageNumber: 1,
            sectionId: "section:B.6",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "Activity shifting leakage may occur in neighboring Cambodia.",
            cleanText: "Activity shifting leakage may occur in neighboring Cambodia.",
            matchingText: "activity shifting leakage may occur in neighboring cambodia.",
            pageNumber: 1,
            sectionId: "section:B.6",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Host country: Cambodia",
            cleanText: "Host country: Cambodia",
            matchingText: "host country: cambodia",
            pageNumber: 1,
            sectionId: "section:B.6",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
    });

    test("country from reference/citation section should not be accepted as host country", () => {
      const rawText = [
        "Methane Capture Project",
        "References",
        "IPCC (2006). Guidelines for National Greenhouse Gas Inventories. Japan.",
        "Country: Japan",
      ].join("\n");

      const contract = compileContract("reference-country", makeStructure({
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
            id: "section:references",
            sectionNumber: "References",
            titleRaw: "References",
            titleClean: "References",
            titleMatchingText: "references",
            bodyRaw: "IPCC (2006). Guidelines for National Greenhouse Gas Inventories. Japan. Country: Japan",
            bodyClean: "IPCC (2006). Guidelines for National Greenhouse Gas Inventories. Japan. Country: Japan",
            bodyMatchingText: "ipcc (2006). guidelines for national greenhouse gas inventories. japan. country: japan",
            displaySnippet: "IPCC (2006). Guidelines for National Greenhouse Gas Inventories.",
            matchingText: "references ipcc (2006). guidelines",
            childIds: [],
            blockIds: ["section-1", "paragraph-1", "field-1"],
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
          blockIds: ["title-1", "section-1", "paragraph-1", "field-1"],
          sourceRefs: [],
        }],
        blocks: [
          {
            id: "title-1",
            type: "heading",
            rawText: "Methane Capture Project",
            cleanText: "Methane Capture Project",
            matchingText: "methane capture project",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.98,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "References",
            cleanText: "References",
            matchingText: "references",
            pageNumber: 1,
            sectionId: "section:references",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "paragraph-1",
            type: "paragraph",
            rawText: "IPCC (2006). Guidelines for National Greenhouse Gas Inventories. Japan.",
            cleanText: "IPCC (2006). Guidelines for National Greenhouse Gas Inventories. Japan.",
            matchingText: "ipcc (2006). guidelines for national greenhouse gas inventories. japan.",
            pageNumber: 1,
            sectionId: "section:references",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Country: Japan",
            cleanText: "Country: Japan",
            matchingText: "country: japan",
            pageNumber: 1,
            sectionId: "section:references",
            sourceRefs: [],
            confidence: 0.95,
          },
        ],
      }));

      expect(contract.hostCountry.value).toBeNull();
    });
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
});
