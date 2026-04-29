import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import StacSupportSection from "@/components/verify/StacSupportSection";

describe("StacSupportSection", () => {
  test("renders truthful AOI/STAC empty, error, and linking states", () => {
    const noAoiHtml = renderToStaticMarkup(
      <StacSupportSection
        eligible
        eligibilityReason="Eligible for STAC support facts."
        supportState={{
          lookupStatus: "requires_aoi",
          lookupMessage: "AOI is required before STAC support facts can be used.",
          searchResultCount: 0,
          linkedFacts: [],
          unlinkedFacts: [],
          availableUnlinkedIds: [],
        }}
      />,
    );
    expect(noAoiHtml).toContain("AOI is required before STAC support facts can be used.");

    const noResultsHtml = renderToStaticMarkup(
      <StacSupportSection
        eligible
        eligibilityReason="Eligible for STAC support facts."
        supportState={{
          lookupStatus: "no_results",
          lookupMessage: "No AOI/STAC support facts were found for the active search.",
          searchResultCount: 0,
          linkedFacts: [],
          unlinkedFacts: [],
          availableUnlinkedIds: [],
        }}
      />,
    );
    expect(noResultsHtml).toContain("No AOI/STAC support facts were found for the active search.");

    const failedHtml = renderToStaticMarkup(
      <StacSupportSection
        eligible
        eligibilityReason="Eligible for STAC support facts."
        supportState={{
          lookupStatus: "lookup_failed",
          lookupMessage: "STAC support-fact lookup failed.",
          lookupError: "Satellite search failed.",
          searchResultCount: 0,
          linkedFacts: [],
          unlinkedFacts: [],
          availableUnlinkedIds: [],
        }}
      />,
    );
    expect(failedHtml).toContain("STAC support-fact lookup failed.");
    expect(failedHtml).toContain("Satellite search failed.");

    const linkedHtml = renderToStaticMarkup(
      <StacSupportSection
        eligible
        eligibilityReason="Eligible for STAC support facts."
        supportState={{
          lookupStatus: "results_available",
          lookupMessage: "1 linked AOI/STAC support fact recorded for this rule.",
          searchResultCount: 2,
          linkedFacts: [
            {
              id: "scene-1",
              datetime: "2026-03-25T00:00:00Z",
              collection: "sentinel-2",
              sourceProvider: "stac.example.test",
              aoiRelationSummary: "Overlaps active AOI bbox",
              linkedAt: "2026-03-25T00:10:00Z",
              sourcePinIds: ["pin-1"],
              linkedRuleIds: ["R-1"],
            },
          ],
          unlinkedFacts: [{ id: "scene-2", sourcePinIds: [], linkedRuleIds: [] }],
          availableUnlinkedIds: ["scene-2"],
        }}
      />,
    );
    expect(linkedHtml).toContain("Linked support facts");
    expect(linkedHtml).toContain("scene-1");
    expect(linkedHtml).toContain("Available but unlinked");
    expect(linkedHtml).toContain("scene-2");
  });
});
