import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";

describe("rules.rich monitoring report schema", () => {
  const schemaPath = path.join(process.cwd(), "schemas", "artifacts", "rules.rich.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
  const validate = ajv.compile(schema);

  test("accepts legacy rich rules that omit monitoring report fields", () => {
    const payload = [
      {
        id: "EXAMPLE.R-1",
        logic: "Keep the existing rich rule contract backward compatible.",
        summary: "Legacy rule remains valid without monitoring report detail.",
        type: "reporting",
      },
    ];

    expect(validate(payload)).toBe(true);
  });

  test("accepts monitoring report expectation fields when present", () => {
    const payload = [
      {
        id: "EXAMPLE.R-2",
        logic: "Monitoring report includes narrative, metrics, and annex expectations.",
        monitoring_report: {
          narrative_expectation: "Describe field activities performed during the reporting period.",
          metrics_expectation: ["Project removals by pool", "Measurement interval used"],
          appendices_expectation: ["Training logs", "Participant list"],
          report_provenance: {
            methodology_source_ref: "UNFCCC/EXAMPLE@v01-0",
            methodology_section_ids: ["S-7"],
            summary: "Anchored to monitoring plan section.",
          },
          reporting_period: {
            cadence: "per monitoring report",
            timing_basis: "Report covers the current verification period.",
          },
        },
        summary: "Monitoring-aware rich rule remains valid.",
        type: "monitoring",
      },
    ];

    expect(validate(payload)).toBe(true);
  });
});
