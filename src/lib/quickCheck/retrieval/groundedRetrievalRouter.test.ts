import { describe, expect, test } from "@jest/globals";
import { compileEvidenceDocument } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { routeGroundedQuestion } from "@/lib/quickCheck/retrieval/groundedRetrievalRouter";

const ROUTER_SAMPLE_TEXT = [
  "Katingan Peatland Restoration and Conservation Project",
  "",
  "1 Project Details",
  "Host country: Indonesia",
  "Project location: Central Kalimantan, Indonesia",
  "Crediting period: 2021 to 2030",
  "",
  "B.2 Baseline Scenario",
  "The baseline scenario is continued peat swamp forest conversion in the absence of the project.",
  "",
  "B.3 Demonstration of additionality",
  "The project is additional because investment barriers and land-use pressure would otherwise prevent conservation.",
  "",
  "D.1 Name and reference of approved monitoring methodology applied",
  "ACM0002 Version 02.0",
  "",
  "D.2 Monitoring plan",
  "The monitoring plan includes annual activity data review and field sampling.",
  "",
  "E.2 Leakage management",
  "Leakage is controlled through livelihood support and patrol coverage in surrounding villages.",
  "",
  "E.6 Leakage statement",
  "Leakage is not expected to be material because project activities remain within the management boundary.",
  "",
  "B.4 Grid emission calculations",
  "Operating Margin (OM) emission factor table",
  "Build Margin (BM) emission factor table",
  "",
  "Page 1 of 20",
].join("\n");

function sampleDocument() {
  return compileEvidenceDocument({
    docId: "router-sample",
    rawText: ROUTER_SAMPLE_TEXT,
  });
}

describe("routeGroundedQuestion", () => {
  test("fact lookup wins for project title", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What is the project title?",
    });

    expect(result.route).toBe("fact_lookup");
    expect(result.answerText).toBe("Katingan Peatland Restoration and Conservation Project");
    expect(result.evidence[0]?.spanId).toBeTruthy();
  });

  test("fact lookup wins for host country", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What is the host country?",
    });

    expect(result.route).toBe("fact_lookup");
    expect(result.answerText).toBe("Indonesia");
    expect(result.evidence[0]?.spanId).toBeTruthy();
  });

  test("monitoring question finds D.1 and D.2 evidence", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about monitoring?",
    });

    expect(result.route).toBe("section_lookup");
    expect(result.evidence.some((item) => item.sectionId === "D.1")).toBe(true);
    expect(result.evidence.some((item) => item.sectionId === "D.2")).toBe(true);
  });

  test("additionality question finds B.3", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about additionality?",
    });

    expect(result.route).toBe("section_lookup");
    expect(result.evidence.every((item) => item.sectionId === "B.3")).toBe(true);
  });

  test("leakage question finds E.2 or E.6", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about leakage?",
    });

    expect(result.route).toBe("section_lookup");
    expect(result.evidence.some((item) => item.sectionId === "E.2" || item.sectionId === "E.6")).toBe(true);
  });

  test("baseline non-calculation question avoids OM/BM tables", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What is the baseline scenario?",
    });

    expect(result.route).toBe("section_lookup");
    expect(result.answerText).toContain("baseline scenario");
    expect(result.evidence.some((item) => /operating margin|build margin/i.test(item.quote))).toBe(false);
    expect(result.evidence.some((item) => item.blockType === "table")).toBe(false);
  });

  test("baseline calculation-specific question may include OM/BM tables", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What baseline method is used for grid emissions calculation?",
    });

    expect(["fact_lookup", "section_lookup", "lexical_retrieval"]).toContain(result.route);
    if (result.route !== "fact_lookup") {
      expect(result.evidence.some((item) => /operating margin|build margin/i.test(item.quote))).toBe(true);
    }
  });

  test("fallback returns no-evidence instead of inventing", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about marine biodiversity offsets?",
    });

    expect(result.route).toBe("fallback");
    expect(result.status).toBe("no_evidence");
    expect(result.answerText).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  test("every returned candidate includes evidence span provenance", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about leakage?",
    });

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((item) => typeof item.spanId === "string" && item.spanId.length > 0)).toBe(true);
  });

  test("quote validation blocks unsupported quotes", () => {
    const result = routeGroundedQuestion({
      document: sampleDocument(),
      question: "What does the document say about additionality?",
      requiredQuote: "This unsupported sentence is not present in the document.",
    });

    expect(result.route).toBe("fallback");
    expect(result.status).toBe("no_evidence");
    expect(result.evidence).toEqual([]);
    expect(result.quoteValidation[result.quoteValidation.length - 1]).toEqual(
      expect.objectContaining({
        valid: false,
        matchType: "missing",
      }),
    );
  });
});
