import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, CLIENT_RULE_HEADINGS, clientRuleFields, clientFacingText } from "@/lib/preverif/marcondesClientReportPresentation";

describe("Marcondes client presentation model", () => {
  it("keeps the exact nine-field contract for all 58 reviewed rules", () => {
    const presentation = buildMarcondesClientReportPresentation(buildMarcondesPreValidationReadinessReport());
    expect(presentation.rules).toHaveLength(58);
    for (const rule of presentation.rules) {
      expect(clientRuleFields(rule).map((field) => field.label)).toEqual(CLIENT_RULE_HEADINGS);
      expect(clientRuleFields(rule).every((field) => typeof field.value === "string")).toBe(true);
    }
    expect(presentation.rules.flatMap(clientRuleFields).some((field) => field.value.includes("2013–2023"))).toBe(true);
  });

  it("reports duplicate source values without rewriting them", () => {
    const presentation = buildMarcondesClientReportPresentation(buildMarcondesPreValidationReadinessReport());
    expect(presentation.rules.filter((rule) => rule.whyItMatters === rule.requiredAction).map((rule) => rule.ruleId)).toEqual([
      "R-5-0006",
      "R-5-0007",
      "R-5-0009",
      "R-6-0003",
      "R-6-0004",
      "R-6-0006",
      "R-6-0007",
    ]);
  });

  it("uses the shared client wording for priority-gap rationale prefixes", () => {
    const source = "Manual review replaced the machine-selected truncated or mislocated evidence for R-1-0004 with PDF-backed evidence. The reviewer validated and corrected the machine proposal using PDF-backed project evidence. The available project evidence is incomplete.";
    expect(clientFacingText(source)).toBe("The reviewed evidence was assessed against the methodology requirement. The reviewer validated and corrected the reviewed project evidence using PDF-backed project evidence. The available project evidence is incomplete.");
    expect(buildMarcondesClientReportPresentation(buildMarcondesPreValidationReadinessReport()).priorityGaps.every((gap) => !gap.whyItMatters.startsWith("Manual review replaced the machine-selected"))).toBe(true);
  });
});
