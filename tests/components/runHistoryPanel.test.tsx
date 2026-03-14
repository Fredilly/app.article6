import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RunHistoryPanel from "@/components/verify/RunHistoryPanel";

describe("RunHistoryPanel", () => {
  it("marks the active run row clearly", () => {
    const html = renderToStaticMarkup(
      <RunHistoryPanel
        items={[
          {
            runId: "run-older",
            createdAt: "2026-01-01T00:00:00Z",
            bundle: {
              runContext: { runId: "run-older", createdAt: "2026-01-01T00:00:00Z" },
              exportedAt: null,
              minutes: "",
              outcomeNote: "",
              checklist: [],
              delta: "",
              impact: "",
              tasks: [],
              selectedRuleId: null,
              linkedRuleIds: [],
              aoi: null,
              evidencePins: [],
              verificationRuns: [],
              selectedStacItemId: null,
            },
          },
        ]}
        activeRunId="run-older"
        onLoad={() => {}}
        showTitle={false}
      />,
    );

    expect(html).toContain("Current");
    expect(html).toContain("active-run-history-row");
  });
});
