import { describe, expect, it } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import EvidenceWorkflowStepper from "@/components/verify/EvidenceWorkflowStepper";
import { getVerifyWizardStepDetails } from "@/lib/verify/runState";

describe("EvidenceWorkflowStepper", () => {
  it("renders reviewer save and finalize as the main lifecycle actions", () => {
    const html = renderToStaticMarkup(
      <EvidenceWorkflowStepper
        ruleOptions={[{ id: "R-1", title: "Rule" }]}
        selectedRuleId="R-1"
        hasAoi
        aoiLabel="AOI"
        searchDisabled={false}
        isRunning={false}
        hasSearchResults
        stacResultCount={1}
        selectedStacItemId="item-1"
        onClearSelectedItem={() => {}}
        canCreatePin
        createPinDisabledReason=""
        pinsCount={1}
        onUploadAoi={() => {}}
        onSearchStac={() => {}}
        onCreatePin={() => {}}
        draftMinutes="Saved reviewer text"
        draftOutcomeNote=""
        savedMinutes="Saved reviewer text"
        savedOutcomeNote=""
        savedReviewerArtifactAt="2026-01-01T00:05:00Z"
        onReviewerMinutesChange={() => {}}
        onReviewerOutcomeNoteChange={() => {}}
        onSaveReviewerArtifact={() => {}}
        onFinalizeRun={() => {}}
        finalizedAt={null}
        currentRunLabel="run-1234"
        isEditedDraft={false}
        hasUnsavedWorkspaceEdits={false}
        currentWorkspaceIsFinal={false}
        wizard={getVerifyWizardStepDetails({
          selectedRuleId: "R-1",
          aoiHash: "aoi",
          stacItemIds: ["item-1"],
          selectedStacItemId: "item-1",
          linkedRuleIds: ["R-1"],
          reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
        })}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );

    expect(html).toContain("Step 6");
    expect(html).toContain("Save reviewer artifact");
    expect(html).toContain("Step 7");
    expect(html).toContain("Finalize run");
    expect(html).toContain("Reviewer artifact saved");
    expect(html).toContain("Ready to finalize");
  });

  it("shows the completion card only after finalization", () => {
    const html = renderToStaticMarkup(
      <EvidenceWorkflowStepper
        ruleOptions={[{ id: "R-1", title: "Rule" }]}
        selectedRuleId="R-1"
        hasAoi
        aoiLabel="AOI"
        searchDisabled={false}
        isRunning={false}
        hasSearchResults
        stacResultCount={1}
        selectedStacItemId="item-1"
        onClearSelectedItem={() => {}}
        canCreatePin
        createPinDisabledReason=""
        pinsCount={1}
        onUploadAoi={() => {}}
        onSearchStac={() => {}}
        onCreatePin={() => {}}
        draftMinutes="Saved reviewer text"
        draftOutcomeNote=""
        savedMinutes="Saved reviewer text"
        savedOutcomeNote=""
        savedReviewerArtifactAt="2026-01-01T00:05:00Z"
        onReviewerMinutesChange={() => {}}
        onReviewerOutcomeNoteChange={() => {}}
        onSaveReviewerArtifact={() => {}}
        onFinalizeRun={() => {}}
        finalizedAt="2026-01-01T00:06:00Z"
        currentRunLabel="run-1234"
        isEditedDraft={false}
        hasUnsavedWorkspaceEdits={false}
        currentWorkspaceIsFinal
        wizard={getVerifyWizardStepDetails({
          selectedRuleId: "R-1",
          aoiHash: "aoi",
          stacItemIds: ["item-1"],
          selectedStacItemId: "item-1",
          linkedRuleIds: ["R-1"],
          reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
          finalizedAt: "2026-01-01T00:06:00Z",
        })}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
        finalizedResult={<div data-testid="finalized-result">Summary lives here</div>}
      />,
    );

    expect(html).toContain("Run complete");
    expect(html).toContain("Summary lives here");
    expect(html).toContain("Start another run");
    expect(html).toContain("View run history");
  });

  it("renders the Step 1 rich rule viewer affordance", () => {
    const html = renderToStaticMarkup(
      <EvidenceWorkflowStepper
        ruleOptions={[{ id: "R-1", title: "Rule" }]}
        selectedRuleId="R-1"
        onViewRule={() => {}}
        hasAoi
        aoiLabel="AOI"
        searchDisabled={false}
        isRunning={false}
        hasSearchResults
        stacResultCount={1}
        selectedStacItemId="item-1"
        onClearSelectedItem={() => {}}
        canCreatePin
        createPinDisabledReason=""
        pinsCount={1}
        onUploadAoi={() => {}}
        onSearchStac={() => {}}
        onCreatePin={() => {}}
        draftMinutes=""
        draftOutcomeNote=""
        savedMinutes=""
        savedOutcomeNote=""
        onReviewerMinutesChange={() => {}}
        onReviewerOutcomeNoteChange={() => {}}
        onSaveReviewerArtifact={() => {}}
        onFinalizeRun={() => {}}
        currentRunLabel="run-1234"
        isEditedDraft={false}
        hasUnsavedWorkspaceEdits={false}
        currentWorkspaceIsFinal={false}
        wizard={getVerifyWizardStepDetails({
          selectedRuleId: "R-1",
          aoiHash: null,
          stacItemIds: [],
          selectedStacItemId: null,
          linkedRuleIds: [],
          reviewerArtifactSavedAt: null,
        })}
        onStartAnotherRun={() => {}}
        onViewRunHistory={() => {}}
      />,
    );

    expect(html).toContain("Step 1");
    expect(html).toContain("View rule");
  });
});
