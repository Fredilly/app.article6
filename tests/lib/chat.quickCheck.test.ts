/** @jest-environment jsdom */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { ensureQuickCheckWorkspaceHandoff, validateQuickCheckDraft, type QuickCheckDraft } from "@/lib/chat/quickCheck";
import { loadPins } from "@/lib/proofMap/storage";

describe("chat quick check helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "pins:AR-ACM0003:v02-0",
      JSON.stringify([
        {
          id: "ev-1",
          kind: "doc",
          title: "Q1 monitoring report",
          cited_ids: [],
          attachments: [
            {
              id: "att-1",
              pin_id: "ev-1",
              filename: "monitoring-report.pdf",
              mime: "application/pdf",
              size: 128,
              sha256: "sha-1",
              created_at: "2026-04-04T00:00:00Z",
            },
          ],
          created_at: "2026-04-04T00:00:00Z",
        },
      ]),
    );
  });

  it("validates required methodology, requirement, and evidence", () => {
    const errors = validateQuickCheckDraft({
      id: "draft-1",
      methodologyId: "",
      methodologyVersion: "",
      requirementId: "",
      evidenceIds: [],
      status: "draft",
      createdAt: "2026-04-04T00:00:00Z",
      updatedAt: "2026-04-04T00:00:00Z",
    });

    expect(errors).toEqual([
      "Choose a methodology before running a quick check.",
      "Choose a requirement before running a quick check.",
      "Attach or select at least one evidence item before running a quick check.",
    ]);
  });

  it("reuses the linked run id on repeated workspace handoff", () => {
    const draft: QuickCheckDraft = {
      id: "draft-1",
      methodologyId: "AR-ACM0003",
      methodologyVersion: "v02-0",
      requirementId: "R-1-0001",
      evidenceIds: ["ev-1"],
      status: "checked",
      createdAt: "2026-04-04T00:00:00Z",
      updatedAt: "2026-04-04T00:00:00Z",
    };

    const first = ensureQuickCheckWorkspaceHandoff(draft);
    const second = ensureQuickCheckWorkspaceHandoff(first.draft);

    expect(first.draft.linkedRunId).toBeTruthy();
    expect(second.draft.linkedRunId).toBe(first.draft.linkedRunId);
    expect(second.url).toBe("/m/AR-ACM0003/v/v02-0?tab=verify&mode=list&rule=R-1-0001");
    expect(loadPins("AR-ACM0003", "v02-0")[0]?.ruleId).toBe("R-1-0001");
    expect(window.localStorage.getItem("verify:AR-ACM0003:v02-0")).toContain(first.draft.linkedRunId as string);
  });
});
