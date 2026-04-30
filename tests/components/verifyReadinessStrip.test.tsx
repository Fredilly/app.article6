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
            detail: "Select a rule to assess AOI/STAC support facts.",
            tone: "blocked",
          },
        ]}
      />,
    );

    expect(html).toContain("Select a rule to inspect rule-specific readiness.");
    expect(html).toContain("Support facts:");
    expect(html).toContain("select rule");
    expect(html).toContain("Select a rule to assess AOI/STAC support facts.");
    expect(html).not.toContain("not applicable");
  });

  test("renders compact truthful readiness chips", () => {
    const html = renderToStaticMarkup(
      <VerifyReadinessStrip
        ruleId="R-1-0001"
        chips={[
          {
            key: "aoi",
            label: "AOI",
            value: "loaded",
            detail: "Project AOI loaded.",
            tone: "ok",
          },
          {
            key: "stac",
            label: "STAC",
            value: "results found",
            detail: "2 STAC results found for the active AOI.",
            tone: "ok",
          },
          {
            key: "support-facts",
            label: "Support facts",
            value: "not applicable",
            detail: "AOI/STAC support facts are not expected for this rule.",
            tone: "neutral",
          },
          {
            key: "reviewer-record",
            label: "Reviewer record",
            value: "draft",
            detail: "Draft reviewer notes exist but are not saved yet.",
            tone: "warn",
          },
          {
            key: "export",
            label: "Export",
            value: "blocked",
            detail: "Save reviewer artifact before finalizing or exporting.",
            tone: "blocked",
          },
        ]}
      />,
    );

    expect(html).toContain("Verify readiness");
    expect(html).toContain("Active rule R-1-0001");
    expect(html).toContain("AOI:");
    expect(html).toContain("loaded");
    expect(html).toContain("STAC:");
    expect(html).toContain("results found");
    expect(html).toContain("Support facts:");
    expect(html).toContain("not applicable");
    expect(html).toContain("Reviewer record:");
    expect(html).toContain("draft");
    expect(html).toContain("Export:");
    expect(html).toContain("blocked");
    expect(html).toContain("AOI/STAC support facts are not expected for this rule.");
  });
});
