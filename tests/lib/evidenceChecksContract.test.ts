import { describe, expect, it } from "@jest/globals";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import {
  getAllChecks,
  getContract,
  getMethodologyChecks,
  validateCheck,
  type CheckValidationContext,
  type EvidenceCheckId,
} from "@/lib/quickCheck/evidenceChecks";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";
import type { ProjectFactId } from "@/lib/quickCheck/queryIntent/types";
import type { DeterministicRouterResult } from "@/lib/quickCheck/retrieval/types";

function makeSpan(input: Partial<EvidenceSpan> & { spanId: string; text: string }): EvidenceSpan {
  return {
    spanId: input.spanId,
    docId: "contract-test-doc",
    page: input.page ?? 1,
    sectionId: input.sectionId,
    heading: input.heading,
    headingPath: input.headingPath ?? (input.heading ? [input.heading] : []),
    sectionPath: input.sectionPath ?? (input.heading ? [input.heading] : []),
    blockType: input.blockType ?? "paragraph",
    text: input.text,
    normalizedText: input.normalizedText ?? input.text.toLowerCase().replace(/\s+/g, " ").trim(),
    charStart: input.charStart ?? 0,
    charEnd: input.charEnd ?? input.text.length,
    sourceBlockId: input.sourceBlockId,
    parserSource: input.parserSource,
    parserAdapterId: input.parserAdapterId,
    documentFamily: input.documentFamily ?? "VERRA_PD",
    layout: input.layout,
    table: input.table,
    reliability: input.reliability ?? "primary",
    confidence: input.confidence ?? 0.95,
  };
}

function emptyField<T extends ProjectFactValue = string | null>(value: T = null as T): ProjectFactField<T> {
  return {
    value,
    confidence: "low",
    evidenceSpanIds: [],
    pageNumbers: [],
    sectionPath: [],
    heading: undefined,
    extractionRule: "test",
    sourceParser: undefined,
    family: "VERRA_PD",
    warnings: [],
  };
}

function groundedField<T extends ProjectFactValue>(
  value: T,
  span: EvidenceSpan,
  extractionRule = "label:test",
): ProjectFactField<T> {
  return {
    value,
    confidence: "high",
    evidenceSpanIds: [span.spanId],
    pageNumbers: span.page == null ? [] : [span.page],
    sectionPath: span.sectionPath,
    heading: span.heading,
    extractionRule,
    sourceParser: span.parserSource,
    family: span.documentFamily ?? "VERRA_PD",
    warnings: [],
  };
}

function baseContract(overrides: Partial<Record<ProjectFactId, ProjectFactField>> = {}): ProjectFactContract {
  return {
    documentFamily: "VERRA_PD",
    documentType: "PROJECT_DESCRIPTION",
    projectTitle: emptyField(),
    projectId: emptyField(),
    hostCountry: emptyField(),
    projectCountry: emptyField(),
    projectLocation: emptyField(),
    projectStandard: emptyField(),
    projectType: emptyField(),
    projectProponent: emptyField(),
    methodologyPrimary: emptyField(),
    methodologyModules: emptyField<string[] | null>(),
    baselineMethodology: emptyField(),
    monitoringMethodology: emptyField(),
    creditingPeriod: emptyField(),
    reportingPeriod: emptyField(),
    monitoringPeriod: emptyField(),
    projectStartDate: emptyField(),
    baselineSections: emptyField<string[] | null>(),
    monitoringSections: emptyField<string[] | null>(),
    leakageSections: emptyField<string[] | null>(),
    additionalitySections: emptyField<string[] | null>(),
    warnings: [],
    ...overrides,
  };
}

const emptySectionTableIndex: SectionTableIndex = {
  documentFamily: "VERRA_PD",
  sectionTree: {
    roots: [],
    orderedNodeIds: [],
    nodesById: {},
  },
  tableIndex: {
    tables: [],
    cells: [],
    byEvidenceSpanId: {},
    byTableId: {},
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
};

const noEvidenceRouterResult: DeterministicRouterResult = {
  answerText: "",
  status: "no_evidence",
  route: "fallback",
  confidence: 0,
  evidenceSpanIds: [],
  quotes: [],
  pages: [],
  sectionPaths: [],
  warnings: [],
};

function makeContext(input: {
  spans?: EvidenceSpan[];
  fields?: Partial<Record<ProjectFactId, ProjectFactField>>;
  rawText?: string;
  routerResult?: DeterministicRouterResult;
  methodologyId?: string;
}): CheckValidationContext {
  const spans = input.spans ?? [];
  const evidenceDocument: EvidenceDocument = {
    docId: "contract-test-doc",
    rawText: input.rawText ?? spans.map((span) => span.text).join("\n"),
    documentFamily: "VERRA_PD",
    spans,
  };
  return {
    evidenceDocument,
    projectFactContract: baseContract(input.fields),
    sectionTableIndex: emptySectionTableIndex,
    routerResult: input.routerResult ?? noEvidenceRouterResult,
    methodologyId: input.methodologyId,
  };
}

function run(checkId: EvidenceCheckId, ctx: CheckValidationContext) {
  return validateCheck(getContract(checkId), ctx);
}

function allCheckIds(): EvidenceCheckId[] {
  return Array.from(new Set([
    ...getAllChecks("VM0007").map((check) => check.id),
    ...getMethodologyChecks("AR-ACM0003").map((check) => check.id),
  ]));
}

describe("Evidence Check contracts", () => {
  it("defines a reusable contract, source policy, answer shape, and mismatch rules for every check", () => {
    for (const checkId of allCheckIds()) {
      const contract = getContract(checkId);
      expect(contract).toBeDefined();
      expect(contract.checkId).toBe(checkId);
      expect(contract.allowedSourceTypes.length).toBeGreaterThan(0);
      expect(contract.expectedShape).toBeTruthy();
      expect(contract.mismatchRules.length).toBeGreaterThan(0);
      expect(contract.requiresGroundedEvidence).toBe(true);
    }
  });

  it("finds valid country evidence only from country-shaped grounded evidence", () => {
    const span = makeSpan({
      spanId: "country-fact",
      text: "Host country: Example Republic",
      blockType: "field",
    });
    const result = run("host_country", makeContext({
      spans: [span],
      fields: {
        hostCountry: groundedField("Example Republic", span),
      },
    }));

    expect(result.status).toBe("found");
    expect(result.answerText).toBe("Example Republic");
    expect(result.evidenceSpanIds).toEqual(["country-fact"]);
    expect(result.pages).toEqual([1]);
    expect(result.quotes[0]).toContain("Host country");
  });

  it("rejects location subregions for host-country checks and returns Unclear when related evidence exists", () => {
    const span = makeSpan({
      spanId: "location-only",
      text: "Project location: Northern Province, River District, Site A",
      blockType: "field",
    });
    const result = run("host_country", makeContext({
      spans: [span],
      fields: {
        projectLocation: groundedField("Northern Province, River District, Site A", span),
      },
    }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/projectLocation|location/i);
  });

  it("finds project-location evidence from a structured fact table", () => {
    const span = makeSpan({
      spanId: "location-fact",
      text: "Project location: Northern region, Site A coordinates 1.2, 3.4",
      blockType: "field",
    });
    const result = run("project_location", makeContext({
      spans: [span],
      fields: {
        projectLocation: groundedField("Northern region, Site A coordinates 1.2, 3.4", span),
      },
    }));

    expect(result.status).toBe("found");
    expect(result.evidenceSpanIds).toEqual(["location-fact"]);
  });

  it("finds a primary methodology but rejects module/tool text as a substitute", () => {
    const primarySpan = makeSpan({
      spanId: "primary-method",
      text: "Applied methodology: VM0007 version 1.0",
      blockType: "field",
    });
    const moduleSpan = makeSpan({
      spanId: "module-only",
      text: "Modules: Tool for testing monitoring parameters",
      blockType: "field",
    });

    expect(run("methodology", makeContext({
      spans: [primarySpan],
      fields: {
        methodologyPrimary: groundedField("VM0007 version 1.0", primarySpan),
      },
    })).status).toBe("found");

    const moduleOnly = run("methodology", makeContext({
      spans: [moduleSpan],
      fields: {
        methodologyModules: groundedField(["Tool for testing monitoring parameters"], moduleSpan),
      },
    }));
    expect(moduleOnly.status).toBe("unclear");
    expect(moduleOnly.downgradeReason).toMatch(/modules|tools|methodologyModules/i);
  });

  it("rejects selected or default structured input as Found evidence", () => {
    const result = run("methodology", makeContext({
      fields: {
        methodologyPrimary: {
          ...emptyField("VM0007 version 1.0"),
          confidence: "high",
          extractionRule: "structured-input",
        },
      },
    }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/structured\/default input/i);
  });

  it("validates date-range shape for crediting periods", () => {
    const span = makeSpan({
      spanId: "crediting-period",
      text: "Crediting period: 1 January 2020 to 31 December 2030",
      blockType: "field",
    });
    const result = run("crediting_period", makeContext({
      spans: [span],
      fields: {
        creditingPeriod: groundedField("1 January 2020 to 31 December 2030", span),
      },
    }));

    expect(result.status).toBe("found");
    expect(result.evidenceSpanIds).toEqual(["crediting-period"]);
  });

  it("does not use crediting-period evidence to satisfy monitoring-period checks", () => {
    const span = makeSpan({
      spanId: "crediting-as-monitoring",
      text: "Crediting period: 1 January 2020 to 31 December 2030",
      blockType: "field",
    });
    const result = run("monitoring_period", makeContext({
      rawText: "Verification report\nCrediting period: 1 January 2020 to 31 December 2030",
      spans: [span],
      fields: {
        creditingPeriod: groundedField("1 January 2020 to 31 December 2030", span),
      },
    }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/crediting|creditingPeriod/i);
  });

  it("rejects generic project-summary text for baseline checks even when keywords overlap", () => {
    const span = makeSpan({
      spanId: "summary-baseline",
      heading: "Project Summary",
      sectionPath: ["Project Summary"],
      text: "The project summary mentions baseline conditions while describing the general project activity and location.",
      blockType: "paragraph",
    });
    const result = run("baseline_scenario", makeContext({ spans: [span] }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/project-description|source type|baseline/i);
  });

  it("rejects project-summary paragraphs as methodology proof", () => {
    const span = makeSpan({
      spanId: "summary-methodology",
      heading: "Project Summary",
      sectionPath: ["Project Summary"],
      text: "The project summary methodology narrative says the activity follows VM0007 version 1.0 while describing the project context.",
      blockType: "paragraph",
    });
    const result = run("methodology", makeContext({ spans: [span] }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/source type project_summary/i);
  });

  it("rejects generic body text for boundary checks", () => {
    const span = makeSpan({
      spanId: "generic-boundary",
      text: "The project boundary is shown in the map and includes the project area and strata.",
      sectionPath: [],
      headingPath: [],
      blockType: "paragraph",
      page: 3,
    });
    const result = run("vm0007_boundary", makeContext({
      spans: [span],
      methodologyId: "VM0007",
    }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/generic_body_text/i);
  });

  it("rejects heading-only and page-artifact candidates", () => {
    const heading = makeSpan({
      spanId: "leakage-heading",
      heading: "Leakage",
      sectionPath: ["Leakage"],
      text: "Leakage",
      blockType: "section_heading",
    });
    const artifact = makeSpan({
      spanId: "leakage-header",
      text: "Page 12 Leakage",
      blockType: "header",
      reliability: "excluded",
      layout: { repeatedHeaderFooter: true },
    });

    const headingResult = run("leakage", makeContext({ spans: [heading] }));
    const artifactResult = run("leakage", makeContext({ spans: [artifact] }));

    expect(headingResult.status).toBe("unclear");
    expect(headingResult.downgradeReason).toMatch(/heading-only/i);
    expect(artifactResult.status).toBe("unclear");
    expect(artifactResult.downgradeReason).toMatch(/artifact/i);
  });

  it("does not reuse another check's answer as Found", () => {
    const span = makeSpan({
      spanId: "host-country-only",
      text: "Host country: Example Republic",
      blockType: "field",
    });
    const result = run("project_location", makeContext({
      spans: [span],
      fields: {
        hostCountry: groundedField("Example Republic", span),
      },
    }));

    expect(result.status).toBe("unclear");
    expect(result.downgradeReason).toMatch(/hostCountry|Country-only/i);
  });

  it("returns Missing when no suitable or related evidence exists", () => {
    const result = run("leakage", makeContext({ spans: [] }));

    expect(result.status).toBe("missing");
    expect(result.downgradeReason).toMatch(/No candidate evidence/i);
  });

  it("returns Not Applicable for document-family mismatch", () => {
    const result = run("monitoring_period", makeContext({
      rawText: "Project description document\nThe document describes project design details.",
      spans: [],
    }));

    expect(result.status).toBe("not_applicable");
    expect(result.downgradeReason).toMatch(/document family pdd/i);
  });

  it("uses reusable answer-shape validators across the required check families", () => {
    expect(getContract("host_country").expectedShape).toBe("country");
    expect(getContract("project_location").expectedShape).toBe("location");
    expect(getContract("methodology").expectedShape).toBe("methodology_code_version");
    expect(getContract("crediting_period").expectedShape).toBe("date_range");
    expect(getContract("monitoring_period").expectedShape).toBe("date_range");
    expect(getContract("baseline_scenario").expectedShape).toBe("narrative_explanation");
    expect(getContract("leakage").expectedShape).toBe("narrative_explanation");
    expect(getContract("safeguards").expectedShape).toBe("narrative_explanation");
    expect(getContract("vm0007_boundary").expectedShape).toBe("boundary_reference_region_leakage_belt");
    expect(getContract("vm0007_monitoring_plan").expectedShape).toBe("monitoring_plan_evidence");
  });
});
