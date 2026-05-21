/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import RuleReviewPanel from "@/components/verify/RuleReviewPanel";
import { getReview, type RuleReview } from "@/lib/verify/reviewStore";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
})();

function dispatchClick(element: Element | null) {
  if (!element) throw new Error("Expected element to exist");
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function dispatchInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  act(() => {
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RuleReviewPanel suggested review", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onSave = jest.fn<(review: RuleReview) => void>();

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    globalThis.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSave.mockReset();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("accepts a suggestion by populating review fields without auto-saving", async () => {
    await act(async () => {
      root.render(
        <RuleReviewPanel
          ruleId="R-1-0007"
          ruleText="Sampling uncertainty kept below 10% at 90% confidence or conservatively adjusted using Tool 12."
          sectionId="S-10"
          methodology="AR-ACM0003"
          version="v02-0"
          existingReview={null}
          expectedEvidence={["Monitoring report", "Spreadsheet workbook", "Calculation support"]}
          expectedEvidenceTypes={["monitoring-report", "spreadsheet-workbook", "calculation-support"]}
          ruleTags={["uncertainty", "monitoring", "sampling"]}
          linkedEvidence={[
            {
              id: "frag-d1",
              title: "D.1 Monitoring plan",
              type: "PDD",
              meta: "project-design.pdf · p. 37",
              excerpt: "Sampling procedures and monitoring variables are described.",
            },
          ]}
          linkedEvidenceDetails={[
            {
              id: "frag-d1",
              title: "D.1 Monitoring plan",
              type: "PDD",
              source: "inventory",
              evidenceId: "ev-pdd",
              fragmentId: "frag-d1",
              fragmentLabel: "D.1 Monitoring plan",
              documentLabel: "project-design.pdf",
              provenanceSummary: "project-design.pdf • D.1 Monitoring plan • p. 37",
              sectionHeading: "Monitoring plan",
              excerpt: "Sampling procedures and monitoring variables are described.",
            },
          ]}
          documentSupport={[
            {
              id: "frag-d1",
              kind: "pdd_excerpt",
              source: "project-design.pdf",
              title: "D.1 Monitoring plan",
              provenance: "project-design.pdf · D.1 Monitoring plan · p. 37",
              excerpt: "Sampling procedures and monitoring variables are described.",
              ruleLinked: true,
            },
          ]}
          onSave={onSave}
        />,
      );
    });

    expect(container.textContent).toContain("Suggested review");
    expect(container.textContent).toContain("Partially supported");
    expect(container.textContent).toContain("uncertainty worksheet");

    dispatchClick(Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Accept suggestion")) ?? null);

    const rationale = container.querySelector('textarea[data-rule-rationale="R-1-0007"]') as HTMLTextAreaElement | null;
    const supportReference = container.querySelector('input[placeholder*="Cite the best supporting trace"]') as HTMLInputElement | null;

    expect(rationale?.value).toContain("does not prove the uncertainty calculation");
    expect(supportReference?.value).toContain("Fragment: D.1 Monitoring plan");
    expect(getReview("R-1-0007", "AR-ACM0003", "v02-0")).toBeNull();
  });

  it("keeps unaccepted suggestions out of finalized review state and only saves reviewer-confirmed edits", async () => {
    await act(async () => {
      root.render(
        <RuleReviewPanel
          ruleId="R-1-0007"
          ruleText="Sampling uncertainty kept below 10% at 90% confidence or conservatively adjusted using Tool 12."
          methodology="AR-ACM0003"
          version="v02-0"
          existingReview={null}
          expectedEvidenceTypes={["monitoring-report", "spreadsheet-workbook", "calculation-support"]}
          ruleTags={["uncertainty", "monitoring", "sampling"]}
          linkedEvidenceDetails={[
            {
              id: "frag-d1",
              title: "D.1 Monitoring plan",
              type: "PDD",
              source: "inventory",
              fragmentId: "frag-d1",
              fragmentLabel: "D.1 Monitoring plan",
              documentLabel: "project-design.pdf",
              provenanceSummary: "project-design.pdf • D.1 Monitoring plan • p. 37",
              excerpt: "Sampling procedures and monitoring variables are described.",
            },
          ]}
          onSave={onSave}
        />,
      );
    });

    dispatchClick(Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Reject suggestion")) ?? null);
    expect(container.textContent).toContain("Unaccepted suggestions are not saved or exported.");

    dispatchClick(
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Needs Follow-up"),
      ) ?? null,
    );

    const rationale = container.querySelector('textarea[data-rule-rationale="R-1-0007"]') as HTMLTextAreaElement;
    const supportReference = container.querySelector('input[placeholder*="Cite the best supporting trace"]') as HTMLInputElement;
    dispatchInput(rationale, "Reviewer confirmed the uncertainty worksheet is still missing.");
    dispatchInput(supportReference, "Manual trace: project-design.pdf · D.1 Monitoring plan");

    dispatchClick(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save review") ?? null);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      ruleId: "R-1-0007",
      status: "needs_followup",
      rationale: "Reviewer confirmed the uncertainty worksheet is still missing.",
      supportReference: "Manual trace: project-design.pdf · D.1 Monitoring plan",
    });
  });
});
