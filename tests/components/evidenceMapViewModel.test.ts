import { EMPTY_EVIDENCE_MAP_FILTERS, filterEvidenceMapRows, summarizeEvidenceMap } from "@/components/preverif/evidence-map/evidenceMapViewModel";
import type { Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";

const rows = [
  { rowId: "found", ruleReference: "R-1", ruleTitle: "Forest boundary", requirementText: "Map the forest.", proposedEvidenceStatus: "FOUND", proposedApplicability: "APPLICABLE", reviewState: "approved", assessmentReason: "Direct support.", gap: "", clientAction: "Review." },
  { rowId: "missing", ruleReference: "R-2", ruleTitle: "Monitoring", requirementText: "Provide monitoring.", proposedEvidenceStatus: "MISSING", proposedApplicability: "APPLICABLE", reviewState: "pending review", assessmentReason: "No evidence.", gap: "Monitoring is absent.", clientAction: "Provide records." },
  { rowId: "na", ruleReference: "R-3", ruleTitle: "Optional module", requirementText: "Module rule.", proposedEvidenceStatus: "UNCLEAR", proposedApplicability: "NOT_APPLICABLE", reviewState: "edited", assessmentReason: "Outside scope.", gap: "", clientAction: "Confirm." },
] as Vm0007EvidenceMapDraftRow[];

test("derives counts and filters without changing row truth", () => {
  const before = structuredClone(rows);
  expect(summarizeEvidenceMap(rows)).toEqual({ total: 3, found: 1, unclear: 1, missing: 1, notApplicable: 1, actionRequired: 2 });
  expect(filterEvidenceMapRows(rows, { ...EMPTY_EVIDENCE_MAP_FILTERS, evidenceState: "MISSING" }).map((row) => row.rowId)).toEqual(["missing"]);
  expect(filterEvidenceMapRows(rows, { ...EMPTY_EVIDENCE_MAP_FILTERS, applicability: "NOT_APPLICABLE" }).map((row) => row.rowId)).toEqual(["na"]);
  expect(filterEvidenceMapRows(rows, { ...EMPTY_EVIDENCE_MAP_FILTERS, reviewState: "approved" }).map((row) => row.rowId)).toEqual(["found"]);
  expect(filterEvidenceMapRows(rows, { ...EMPTY_EVIDENCE_MAP_FILTERS, query: "monitoring" }).map((row) => row.rowId)).toEqual(["missing"]);
  expect(rows).toEqual(before);
});
