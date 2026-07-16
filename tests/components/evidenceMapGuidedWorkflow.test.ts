import {
  findEvidenceMapNavigationTarget,
  summarizeEvidenceMapWorkflow,
  type EvidenceMapPresentationRow,
} from "@/components/preverif/evidence-map/evidenceMapPresentationModel";

function row(rowId: string, unresolved = false, blockerReasons: readonly string[] = unresolved ? ["needs review"] : []): EvidenceMapPresentationRow {
  return {
    rowId, stableRuleId: rowId, ruleReference: rowId, ruleTitle: rowId, requirementText: "Requirement",
    evidenceState: "MISSING", applicability: "APPLICABLE", reviewerOutcome: "NONE", reviewState: "pending review",
    acceptedEvidence: [], rejectedEvidence: [], draftFindingCandidate: null, contradictionState: null,
    clientAction: "", gap: "", rawAuditStatus: null, confidence: null, assessmentReason: null,
    notApplicable: false, actionRequired: unresolved, supportedComponents: null, missingComponents: null,
    reasonSelected: null, reviewHistory: [], unresolved, blockerReasons,
  };
}

test("guided progress is derived from row data and navigation follows stable canonical order", () => {
  const rows = [row("R-1"), row("R-2", true, ["canonical assessment stale"]), row("R-3", true, ["canonical assessment missing"]), row("R-4")];
  expect(summarizeEvidenceMapWorkflow(rows)).toEqual({ total: 4, complete: 2, unresolved: 2, blocked: 2 });
  expect(findEvidenceMapNavigationTarget(rows, "R-1", "next").rowId).toBe("R-2");
  expect(findEvidenceMapNavigationTarget(rows, "R-1", "unresolved").rowId).toBe("R-2");
  expect(findEvidenceMapNavigationTarget(rows, "R-2", "blocker").rowId).toBe("R-3");
  expect(findEvidenceMapNavigationTarget(rows, "R-1", "previous")).toBeNull();
  expect(findEvidenceMapNavigationTarget(rows, "R-4", "next")).toBeNull();
  expect(findEvidenceMapNavigationTarget(rows, null, "unresolved").rowId).toBe("R-2");
  expect(findEvidenceMapNavigationTarget(rows, null, "blocker").rowId).toBe("R-2");
  expect(findEvidenceMapNavigationTarget([row("only", true)], null, "unresolved")?.rowId).toBe("only");
  expect(findEvidenceMapNavigationTarget(rows, "R-3", "unresolved").rowId).toBe("R-2");
});
