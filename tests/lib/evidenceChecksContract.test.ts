import { describe, expect, it } from "@jest/globals";

import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import {
  getAllChecks,
  getContract,
  getMethodologyChecks,
  getProjectIdentityChecks,
  getUniversalChecks,
  validateCheck,
  type CheckValidationContext,
  type EvidenceCheckId,
} from "@/lib/quickCheck/evidenceChecks";
import type { SectionTableIndex } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract, ProjectFactField, ProjectFactValue } from "@/lib/quickCheck/projectFacts/types";
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

function baseContract(overrides: Partial<ProjectFactContract> = {}): ProjectFactContract {
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
  contract?: Partial<ProjectFactContract>;
  rawText?: string;
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
    projectFactContract: baseContract(input.contract),
    sectionTableIndex: emptySectionTableIndex,
    routerResult: noEvidenceRouterResult,
  };
}

function run(checkId: EvidenceCheckId, ctx: CheckValidationContext) {
  return validateCheck(getContract(checkId), ctx);
}

describe("Evidence Check contracts", () => {
  it("exposes only the six project identity rows in the intended order", () => {
    expect(getProjectIdentityChecks().map((check) => check.id)).toEqual([
      "project_title",
      "host_country",
      "project_location",
      "methodology",
      "crediting_period",
      "project_activity",
    ]);
  });

  it("hides non-identity check groups", () => {
    expect(getUniversalChecks()).toEqual([]);
    expect(getMethodologyChecks("VM0007")).toEqual([]);
    expect(getAllChecks("VM0007").map((check) => check.id)).toEqual([
      "project_title",
      "host_country",
      "project_location",
      "methodology",
      "crediting_period",
      "project_activity",
    ]);
  });

  it("returns found only when trusted host-country evidence has quote, page, and span ids", () => {
    const span = makeSpan({
      spanId: "country-fact",
      blockType: "field",
      heading: "Project details",
      sectionPath: ["Project details"],
      text: "Host country: Guinea-Bissau",
    });

    const result = run("host_country", makeContext({
      spans: [span],
      contract: {
        hostCountry: groundedField("Guinea-Bissau", span),
      },
    }));

    expect(result.status).toBe("found");
    expect(result.answerText).toBe("Guinea-Bissau");
    expect(result.quotes[0]).toContain("Host country");
    expect(result.pages).toEqual([1]);
    expect(result.sections).toEqual(["Project details"]);
    expect(result.evidenceSpanIds).toEqual(["country-fact"]);
  });

  it("falls back to deterministic project-country evidence derived from location", () => {
    const span = makeSpan({
      spanId: "location-fact",
      blockType: "field",
      heading: "Project details",
      sectionPath: ["Project details"],
      text: "Project location: Republic of Guinea-Bissau, Cacheu and Cantanhez",
    });

    const result = run("host_country", makeContext({
      spans: [span],
      contract: {
        projectCountry: groundedField("Guinea-Bissau", span, "project-country:location-fallback"),
      },
    }));

    expect(result.status).toBe("found");
    expect(result.answerText).toBe("Guinea-Bissau");
    expect(result.answerText).not.toContain("Portugal");
  });

  it("rejects structured-input methodology without document evidence", () => {
    const result = run("methodology", makeContext({
      contract: {
        methodologyPrimary: {
          ...emptyField("VM0007 · 4.2"),
          confidence: "high",
          extractionRule: "structured-input",
        },
      },
    }));

    expect(result.status).toBe("missing");
    expect(result.downgradeReason).toMatch(/no trusted evidence/i);
  });

  it("rejects untrusted spans for visible checks", () => {
    const span = makeSpan({
      spanId: "figure-country",
      blockType: "paragraph",
      heading: "Figure 2",
      sectionPath: ["Figure 2"],
      text: "Source: Portugal map source for Republic of Guinea-Bissau boundaries",
    });

    const result = run("host_country", makeContext({
      spans: [span],
      contract: {
        hostCountry: groundedField("Portugal", span),
      },
    }));

    expect(result.status).toBe("missing");
  });

  it("rejects project-activity evidence that looks like biomass or chart text", () => {
    const span = makeSpan({
      spanId: "activity-noise",
      blockType: "paragraph",
      heading: "Summary description of the project",
      sectionPath: ["Summary description of the project"],
      text: "Project activity: Rhizophora AGB equation with DBH and Chave chart values.",
    });

    const result = run("project_activity", makeContext({
      spans: [span],
      contract: {
        projectType: groundedField("Rhizophora AGB equation with DBH and Chave chart values", span),
      },
    }));

    expect(result.status).toBe("missing");
    expect(result.downgradeReason).toMatch(/excluded biomass, equation, or chart text/i);
  });

  it("returns not_applicable when the document family does not support the crediting-period row", () => {
    const span = makeSpan({
      spanId: "crediting",
      blockType: "field",
      heading: "Project details",
      sectionPath: ["Project details"],
      text: "Project crediting period: 1 January 2020 - 31 December 2030",
      documentFamily: "UNKNOWN",
    });

    const result = validateCheck(getContract("crediting_period"), {
      evidenceDocument: {
        docId: "contract-test-doc",
        rawText: span.text,
        documentFamily: "UNKNOWN",
        spans: [span],
      },
      projectFactContract: baseContract({
        documentFamily: "UNKNOWN",
        creditingPeriod: groundedField("1 January 2020 - 31 December 2030", span),
      }),
      sectionTableIndex: emptySectionTableIndex,
      routerResult: noEvidenceRouterResult,
    });

    expect(result.status).toBe("not_applicable");
  });
});
