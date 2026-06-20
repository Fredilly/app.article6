import { describe, expect, it } from "@jest/globals";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";

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

function buildResult(claimText: string, rawPddText: string) {
  return buildReviewQuestionResult({
    claimText,
    methodologyId: "VM0007",
    methodologyVersion: "4.2",
    rawPddText,
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
});
