import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { buildReviewQuestionResult, getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { assessCheckSpecEvidence } from "@/lib/quickCheck/router/deterministicRouter";

const STRONG_BASELINE_TEXT = [
  "2.4 Baseline Scenario",
  "The baseline scenario is continued grazing pressure and fuelwood extraction without the project.",
  "Remote sensing and field observations support the without-project scenario.",
].join("\n");

const BASELINE_METHODOLOGY_FALSE_POSITIVE_TEXT = [
  "2.4 Baseline Scenario",
  "According to the methodology, the baseline scenario shall be determined using the applicable module.",
  "The methodology determines the baseline and leakage approach.",
].join("\n");

const STRONG_ADDITIONALITY_TEXT = [
  "2.6 Additionality",
  "The project is additional because the barrier analysis shows that implementation is financially unattractive without carbon revenues.",
  "The investment analysis further demonstrates that the project would not proceed under the baseline case.",
].join("\n");

const WEAK_ADDITIONALITY_TEXT = [
  "2.6 Additionality",
  "Additionality is discussed for the project in this section.",
  "Further evidence is referenced elsewhere.",
].join("\n");

const REJECT_ADDITIONALITY_TEXT = [
  "2.6 Additionality",
  "The latest approved version of the Tool for the Demonstration and Assessment of Additionality is applied.",
  "The methodology framework is followed.",
].join("\n");

const STRONG_MONITORING_TEXT = [
  "4.3 Monitoring Plan",
  "The monitoring plan measures forest cover change and biomass annually using remote sensing and permanent sample plots.",
  "Monitoring frequency is annual and the data source for each parameter is recorded in the monitoring database.",
].join("\n");

const GENERIC_MONITORING_METHODOLOGY_TEXT = [
  "4.3 Monitoring",
  "According to the monitoring methodology, parameters shall be monitored in accordance with the methodology requirements.",
  "This methodology requires monitoring of all relevant parameters.",
].join("\n");

const FACT_PDD_TEXT = [
  "Project Title: Coastal Mangrove Restoration Project",
  "Host Country: Kenya",
  "Project Proponent: Blue Carbon Initiative",
  "Methodology Applied: VM0007 REDD+ Methodology Framework",
  "",
  "2.2 Project Location",
  "The project is located in Lamu County, Kenya.",
].join("\n");

const TOC_ONLY_ADDITIONALITY_TEXT = [
  "Table of Contents",
  "3.1 Additionality ........................................................ 12",
].join("\n");

const TOC_ONLY_BASELINE_TEXT = [
  "Table of Contents",
  "2.4 Baseline Scenario .................................................... 8",
].join("\n");

const TOC_ONLY_MONITORING_TEXT = [
  "Table of Contents",
  "4.3 Monitoring Plan ...................................................... 14",
].join("\n");

const EXISTING_TOC_FIXTURE = fs.readFileSync(
  path.join(__dirname, "../fixtures/quick-check/eval/plum-toc-only-stakeholder.txt"),
  "utf8",
);

function buildResult(claimText: string, rawPddText: string) {
  return buildReviewQuestionResult({
    claimText,
    methodologyId: "VM0007",
    methodologyVersion: "4.2",
    rawPddText,
  });
}

function assessResult(
  claimText: string,
  rawPddText: string,
  reviewArea: "additionality" | "baseline" | "monitoring",
) {
  const context = getStructuredQueryContext(rawPddText);
  const spans = context.evidenceDocument.spans.filter((span) => span.reliability !== "excluded");

  return assessCheckSpecEvidence({
    claimText,
    reviewArea,
    evidenceDocument: context.evidenceDocument,
    candidate: {
      route: "lexical_retrieval",
      answerText: spans.map((span) => span.text).join("\n"),
      evidenceSpanIds: spans.map((span) => span.spanId),
      quoteTexts: spans.map((span) => span.text),
      sectionPaths: spans.flatMap((span) => span.sectionPath),
    },
  });
}

function expectAnsweredProvenance(result: ReturnType<typeof buildResult>) {
  expect(result.routerResult.status).toBe("answered");
  expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
  expect(result.routerResult.quotes.length).toBeGreaterThan(0);
  expect(result.routerResult.pages.length).toBeGreaterThan(0);
  expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);
}

describe("quick check evidence sufficiency", () => {
  it("accepts strong additionality evidence", () => {
    const result = buildResult("Is additionality demonstrated?", STRONG_ADDITIONALITY_TEXT);

    expect(result.reviewArea).toBe("additionality");
    expectAnsweredProvenance(result);
  });

  it("downgrades weak additionality evidence to unclear", () => {
    const result = buildResult("Is additionality demonstrated?", WEAK_ADDITIONALITY_TEXT);

    expect(result.reviewArea).toBe("additionality");
    expect(result.routerResult.status).toBe("unclear");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("check_spec_additionality_weak");
  });

  it("rejects thin additionality tool evidence", () => {
    const result = buildResult("Is additionality demonstrated?", REJECT_ADDITIONALITY_TEXT);

    expect(result.reviewArea).toBe("additionality");
    expect(result.routerResult.status).toBe("no_evidence");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("check_spec_additionality_methodology_reject");
  });

  it("accepts strong baseline scenario evidence", () => {
    const result = buildResult("Explain the baseline scenario.", STRONG_BASELINE_TEXT);

    expect(result.reviewArea).toBe("baseline");
    expectAnsweredProvenance(result);
  });

  it("rejects baseline methodology-text false positives", () => {
    const result = buildResult("Explain the baseline scenario.", BASELINE_METHODOLOGY_FALSE_POSITIVE_TEXT);

    expect(result.reviewArea).toBe("baseline");
    expect(result.routerResult.status).toBe("no_evidence");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("check_spec_baseline_methodology_reject");
  });

  it("accepts monitoring plan evidence", () => {
    const result = buildResult("Check the monitoring plan.", STRONG_MONITORING_TEXT);

    expect(result.reviewArea).toBe("monitoring");
    expectAnsweredProvenance(result);
  });

  it("rejects generic monitoring methodology false positives", () => {
    const result = buildResult("Check the monitoring plan.", GENERIC_MONITORING_METHODOLOGY_TEXT);

    expect(result.reviewArea).toBe("monitoring");
    expect(result.routerResult.status).toBe("no_evidence");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("check_spec_monitoring_methodology_reject");
  });

  it("rejects TOC-only additionality evidence", () => {
    const assessment = assessResult("Is additionality demonstrated?", TOC_ONLY_ADDITIONALITY_TEXT, "additionality");

    expect(assessment).toMatchObject({
      specId: "additionality",
      grade: "reject",
      warningCode: "check_spec_additionality_toc_reject",
    });
  });

  it("rejects TOC-only baseline evidence", () => {
    const assessment = assessResult("Explain the baseline scenario.", TOC_ONLY_BASELINE_TEXT, "baseline");

    expect(assessment).toMatchObject({
      specId: "baseline_scenario",
      grade: "reject",
      warningCode: "check_spec_baseline_scenario_toc_reject",
    });
  });

  it("rejects TOC-only monitoring evidence", () => {
    const assessment = assessResult("Check the monitoring plan.", TOC_ONLY_MONITORING_TEXT, "monitoring");

    expect(assessment).toMatchObject({
      specId: "monitoring",
      grade: "reject",
      warningCode: "check_spec_monitoring_toc_reject",
    });
  });

  it("does not affect ProjectFactContract fact answers", () => {
    const result = buildResult("What is the project title and host country?", FACT_PDD_TEXT);

    expect(result.routerResult.route).toBe("project_fact_contract");
    expect(result.routerResult.status).toBe("answered");
    expect(result.routerResult.answerText).toContain("Project title:");
    expect(result.routerResult.answerText).toContain("Host country: Kenya.");
    expectAnsweredProvenance(result);
  });

  it("downgrades an existing TOC false positive fixture to unclear", () => {
    const result = buildResult("Check the monitoring plan.", EXISTING_TOC_FIXTURE);

    expect(result.reviewArea).toBe("monitoring");
    expect(result.routerResult.status).toBe("unclear");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("ambiguous_intent");
  });
});
