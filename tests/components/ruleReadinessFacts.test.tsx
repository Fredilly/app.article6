import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RuleReadinessFacts from "@/components/verify/RuleReadinessFacts";
import type { RuleReadinessGap } from "@/lib/readiness/gapEngine";

const missingEvidenceGap: RuleReadinessGap = {
  ruleId: "R-1",
  title: "Monitoring frequency",
  state: "missing_evidence",
  severity: "high",
  summary: "Some expected evidence is still missing: Monitoring report.",
  expectedEvidenceTypes: ["monitoring-report"],
  linkedEvidence: [],
  candidateEvidence: [],
  missingExpectedEvidenceTypes: ["monitoring-report"],
  recommendations: [
    {
      code: "link_expected_evidence",
      label: "Link expected evidence",
      detail: "Link evidence that satisfies: Monitoring report.",
    },
  ],
  override: {
    state: "needs_review",
    severity: "medium",
    reason: "Expectation encoding still needs clarification.",
    reviewer: "Verifier A",
    updatedAt: "2026-05-04T00:00:00Z",
  },
  baseState: "missing_evidence",
  baseSeverity: "high",
};

describe("RuleReadinessFacts", () => {
  test("renders compact rule readiness facts from the engine output", () => {
    const html = renderToStaticMarkup(
      <RuleReadinessFacts
        ruleId="R-1"
        gap={missingEvidenceGap}
      />,
    );

    expect(html).toContain("Rule readiness");
    expect(html).toContain("Missing Evidence");
    expect(html).toContain("Severity: High");
    expect(html).toContain("Missing:");
    expect(html).toContain("Monitoring report");
    expect(html).toContain("Next step:");
    expect(html).toContain("Link expected evidence");
    expect(html).toContain("Reviewer override:");
    expect(html).toContain("Needs Review (Medium) — Expectation encoding still needs clarification.");
  });

  test("renders no-rule state without looking broken and avoids forbidden claim language", () => {
    const html = renderToStaticMarkup(<RuleReadinessFacts ruleId={null} gap={null} />).toLowerCase();

    expect(html).toContain("rule readiness");
    expect(html).toContain("not assessed");
    expect(html).toContain("select a rule to inspect rule-specific readiness facts.");
    expect(html).not.toContain("verification opinion");
    expect(html).not.toContain("registry approval");
    expect(html).not.toContain("credit issuance");
    expect(html).not.toContain("verified credits");
  });
});
