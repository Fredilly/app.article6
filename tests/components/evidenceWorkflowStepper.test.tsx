/** @jest-environment jsdom */

import { act } from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { createRoot } from "react-dom/client";
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

    expect(html).toContain("Step 5");
    expect(html).toContain("Save &amp; finalize");
    expect(html).toContain("Save reviewer artifact");
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
        onViewOutcome={() => {}}
        methodCode="app.article6"
        version="v1"
        reviewedRuleCount={1}
        linkedEvidenceCount={1}
        finalizedResult={<div data-testid="finalized-result">Summary lives here</div>}
      />,
    );

    expect(html).toContain("Workflow completed");
    expect(html).toContain("Finalized");
    expect(html).toContain("app.article6@v1");
    expect(html).toContain("1 reviewed rule");
    expect(html).toContain("1 linked evidence item");
    expect(html).not.toContain("Summary lives here");
    expect(html).toContain("View outcome");
    expect(html).toContain("Start another run");
    expect(html).toContain("Expand workflow");
    expect(html).not.toContain("Current workspace");
    expect(html).not.toContain("Next required action");
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

  it("renders short rule picker labels without duplicating canonical prefixes", () => {
    const html = renderToStaticMarkup(
      <EvidenceWorkflowStepper
        ruleOptions={[
          {
            id: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001",
            title: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001",
          },
          {
            id: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002",
            title: "Project boundary",
          },
        ]}
        selectedRuleId="UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001"
        onViewRule={() => {}}
        hasAoi
        aoiLabel="AOI"
        searchDisabled={false}
        isRunning={false}
        hasSearchResults={false}
        stacResultCount={0}
        selectedStacItemId={null}
        onClearSelectedItem={() => {}}
        canCreatePin={false}
        createPinDisabledReason=""
        pinsCount={0}
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
          selectedRuleId: "UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001",
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

    expect(html).toContain(">R-1-0001<");
    expect(html).toContain(">R-1-0002 - Project boundary<");
    expect(html).not.toContain("R-1-0001 - UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0001");
  });

  it("reopens the completed workflow on demand after finalization", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onViewOutcome = jest.fn();

    await act(async () => {
      root.render(
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
          onViewOutcome={onViewOutcome}
          methodCode="app.article6"
          version="v1"
          linkedEvidenceCount={1}
          finalizedResult={<div data-testid="finalized-result">Summary lives here</div>}
        />,
      );
    });

    expect(container.textContent).toContain("Workflow completed");
    expect(container.textContent).toContain("Expand workflow");
    expect(container.textContent).not.toContain("Summary lives here");

    await act(async () => {
      (container.querySelector('[data-testid="wizard-completed-summary"] button') as HTMLButtonElement).click();
    });

    expect(onViewOutcome).toHaveBeenCalledTimes(1);

    await act(async () => {
      const buttons = Array.from(container.querySelectorAll("button"));
      const expandButton = buttons.find((button) => button.textContent === "Expand workflow") as HTMLButtonElement;
      expandButton.click();
    });

    expect(container.textContent).toContain("Collapse workflow");
    expect(container.textContent).toContain("Completed audit detail");
    expect(container.textContent).toContain("Audit history");
    expect(container.textContent).toContain("Summary lives here");
    expect(container.textContent).toContain("View run history");
    expect(container.textContent).not.toContain("Current workspace");
    expect(container.textContent).not.toContain("Next required action");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).not.toContain("Finalize run");
    expect(container.querySelector("select")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
