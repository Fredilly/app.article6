import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import VerifyReadinessStrip from "@/components/verify/VerifyReadinessStrip";

describe("VerifyReadinessStrip", () => {
  test("keeps no selected rule distinct from not applicable", () => {
    const html = renderToStaticMarkup(
      <VerifyReadinessStrip
        ruleId={null}
        chips={[
          {
            key: "support-facts",
            label: "Support facts",
            value: "select rule",
            detail: "Select a rule to assess area/satellite support facts.",
            tone: "blocked",
          },
        ]}
      />,
    );

    expect(html).toContain("Select a rule to inspect rule-specific readiness.");
    expect(html).toContain("Support facts:");
    expect(html).toContain("select rule");
    expect(html).toContain("Select a rule to assess area/satellite support facts.");
    expect(html).not.toContain("not applicable");
  });

  test("renders compact truthful readiness chips", () => {
    const html = renderToStaticMarkup(
      <VerifyReadinessStrip
        ruleId="R-1-0001"
        chips={[
          {
            key: "aoi",
            label: "Area",
            value: "ready",
            detail: "Project area ready.",
            tone: "ok",
          },
          {
            key: "stac",
            label: "Satellite",
            value: "found",
            detail: "2 satellite results found for the current area.",
            tone: "ok",
          },
          {
            key: "support-facts",
            label: "Support",
            value: "optional",
            detail: "Area/satellite support facts are optional for this rule. Link them only if they materially support the review.",
            tone: "neutral",
          },
          {
            key: "reviewer-record",
            label: "Reviewer",
            value: "draft",
            detail: "Draft reviewer notes exist but are not saved yet.",
            tone: "warn",
          },
          {
            key: "export",
            label: "Export",
            value: "draft",
            detail: "Draft snapshot exported 2026-03-25 00:10:00. Final export still needs finalize requirements to pass.",
            tone: "warn",
          },
        ]}
      />,
    );

    expect(html).toContain("Verify readiness");
    expect(html).toContain("Active rule R-1-0001");
    expect(html).toContain("Area:");
    expect(html).toContain("ready");
    expect(html).toContain("Satellite:");
    expect(html).toContain("found");
    expect(html).toContain("Support:");
    expect(html).toContain("optional");
    expect(html).toContain("Reviewer:");
    expect(html).toContain("draft");
    expect(html).toContain("Export:");
    expect(html).toContain("draft");
    expect(html).toContain("Area/satellite support facts are optional for this rule. Link them only if they materially support the review.");
    expect(html).toContain("Draft snapshot exported 2026-03-25 00:10:00. Final export still needs finalize requirements to pass.");
  });
});
