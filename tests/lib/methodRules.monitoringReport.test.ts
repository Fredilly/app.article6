import { loadMethodRules } from "@/app/m/_lib/methodRules";

describe("loadMethodRules monitoring report expectations", () => {
  test("exposes source-backed monitoring report expectations from rich rules", async () => {
    const result = await loadMethodRules("AR-AMS0003", "v01-0");
    const monitoringPlanRule = result.byId.get("UNFCCC.Forestry.AR-AMS0003.v01-0.R-1-0007");
    const annexRule = result.byId.get("UNFCCC.Forestry.AR-AMS0003.v01-0.R-1-0013");

    expect(result.source).toBe("rules.rich.json");
    expect(monitoringPlanRule?.monitoringReport).toEqual({
      narrative_expectation:
        "Describe permanent plot re-measurement activities, grouped participant compliance tracking, and QA/QC execution for the reporting period.",
      metrics_expectation: [
        "Permanent plot measurement dates and remeasurement interval",
        "Grouped participant compliance log coverage for the reporting period",
      ],
      report_provenance: {
        methodology_source_ref: "UNFCCC/AR-AMS0003@v01-0",
        methodology_section_ids: ["S-7"],
        summary: "Monitoring plan requirement anchored to the methodology monitoring plan section.",
      },
      reporting_period: {
        cadence: "per verification cycle",
        timing_basis:
          "Plot measurements occur at ≤5-year intervals and participant compliance logs are reviewed each verification.",
      },
    });

    expect(annexRule?.monitoringReport?.appendices_expectation).toEqual([
      "Participant enrollment records",
      "Training logs",
      "Dispute resolution evidence",
    ]);
  });

  test("omits monitoring report expectations when the rich rule does not define them", async () => {
    const result = await loadMethodRules("AR-AMS0003", "v01-0");
    const eligibilityRule = result.byId.get("UNFCCC.Forestry.AR-AMS0003.v01-0.R-1-0001");

    expect(eligibilityRule?.monitoringReport).toBeUndefined();
  });

  test("loads monitoring report expectations deterministically across repeated reads", async () => {
    const first = await loadMethodRules("AR-AMS0003", "v01-0");
    const second = await loadMethodRules("AR-AMS0003", "v01-0");

    expect(first.rules).toEqual(second.rules);
    expect(first.byId.get("UNFCCC.Forestry.AR-AMS0003.v01-0.R-1-0007")?.monitoringReport).toEqual(
      second.byId.get("UNFCCC.Forestry.AR-AMS0003.v01-0.R-1-0007")?.monitoringReport,
    );
  });
});
