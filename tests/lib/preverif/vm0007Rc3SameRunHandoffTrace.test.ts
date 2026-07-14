import fs from "node:fs";
import path from "node:path";

import { auditEvidence, type MethodologyEvidenceAuditResult } from "@/lib/preverif/evidenceAudit";
import { buildVm0007Rc3SameRunHandoffTrace, classifySameRunHandoff, serializeVm0007Rc3SameRunHandoffTrace, validateVm0007Rc3SameRunHandoffTrace, type HandoffIdentity } from "@/lib/preverif/vm0007Rc3SameRunHandoffTrace";

const root = process.cwd();
const artifactPath = path.join(root, "docs/roadmaps/interactive-evidence-review-mvp/RC3_SAME_RUN_HANDOFF_TRACE.json");
const identity: HandoffIdentity = { quote: "target quote", normalizedQuote: "target quote", spanId: "target-span", page: 2, ruleId: "rule-1", provenance: null };
const result = (overrides: Partial<MethodologyEvidenceAuditResult> = {}): MethodologyEvidenceAuditResult => ({
  ruleId: "rule-1", stableId: "rule-1", title: "Rule", ruleLogic: "logic", status: "supported_by_pdd",
  bestEvidenceQuote: "target quote", evidence: [{ quote: "target quote", page: 2, section: "S", span: "target-span" }],
  rejectedEvidence: [], page: 2, section: "S", span: "target-span", reasonSelected: "selected", assessmentReason: "reason", gap: "", clientAction: "action", confidence: "high", ...overrides,
});
const row = (overrides: Record<string, unknown> = {}) => ({
  stableRuleId: "rule-1",
  acceptedEvidence: [{ quote: "target quote", page: 2, section: "S", spanId: "target-span", provenance: { docId: "doc", page: 2, sectionPath: ["S"], spanId: "target-span", sectionHeading: "S", sourceType: "PDD" } }],
  proposedAcceptedEvidence: { quote: "target quote", provenance: { docId: "doc", page: 2, sectionPath: ["S"], spanId: "target-span", sectionHeading: "S", sourceType: "PDD" } },
  quote: "target quote", spanId: "target-span", provenance: { docId: "doc", page: 2, sectionPath: ["S"], spanId: "target-span", sectionHeading: "S", sourceType: "PDD" }, ...overrides,
} as any);

describe("RC3-3 same-run audit-to-proposal handoff", () => {
  it.each([
    ["missing from audit", "selected_missing_from_audit_result", result({ bestEvidenceQuote: null, evidence: [], span: null }), null, null],
    ["present in evidence but not best", "selected_present_in_evidence_but_not_best_evidence", result({ bestEvidenceQuote: "other", span: "other-span" }), row(), row()],
    ["dropped by draft mapping", "audit_result_present_but_draft_mapping_dropped", result(), row({ acceptedEvidence: [], proposedAcceptedEvidence: null, quote: null, spanId: null, provenance: null }), row({ acceptedEvidence: [], proposedAcceptedEvidence: null, quote: null, spanId: null, provenance: null })],
    ["lost on serialization", "draft_present_but_serialization_dropped", result(), row(), row({ acceptedEvidence: [], proposedAcceptedEvidence: null, quote: null, spanId: null, provenance: null })],
    ["survives in same-run proposal", "same_run_proposal_contains_selected_candidate", result(), row(), row()],
  ] as const)("classifies a candidate %s", (_name, expected, audit, draft, reloaded) => {
    const classified = classifySameRunHandoff({ selectedCandidate: identity, auditResult: audit, draftRow: draft, reloadedRow: reloaded });
    expect(classified.primaryStage).toBe(expected);
    if (expected === "selected_present_in_evidence_but_not_best_evidence") {
      expect(classified.stagePresence.bestEvidenceDivergence).toBe(true);
      expect(classified.stagePresence.sameRunProposalContainsSelectedCandidate).toBe(true);
      expect(classified.secondaryConditions).toContain("same_run_proposal_contains_selected_candidate");
    }
  });

  it("keeps duplicate cardinality as a separate condition", () => {
    const classified = classifySameRunHandoff({ selectedCandidate: identity, auditResult: result(), draftRow: row(), reloadedRow: row(), duplicateCardinalityMismatch: true });
    expect(classified.primaryStage).toBe("same_run_proposal_contains_selected_candidate");
    expect(classified.secondaryConditions).toContain("duplicate_cardinality_mismatch");
    expect(classified.stagePresence.duplicateCardinalityComplication).toBe(true);
  });

  it("fails closed for empty, duplicate, and missing event IDs", () => {
    const value = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    expect(() => validateVm0007Rc3SameRunHandoffTrace({ ...value, events: value.events.slice(0, -1), parentEventCount: 47 })).toThrow("event count");
    expect(() => validateVm0007Rc3SameRunHandoffTrace({ ...value, events: [...value.events.slice(0, -1), value.events[0]] })).toThrow("Duplicate");
    expect(() => validateVm0007Rc3SameRunHandoffTrace({ ...value, events: [{ ...value.events[0], eventId: "" }, ...value.events.slice(1)] })).toThrow("Missing same-run handoff event ID");
  });

  it("fails closed for missing selected candidates and each rule alignment", () => {
    expect(() => buildVm0007Rc3SameRunHandoffTrace({
      diagnosticEvents: Array.from({ length: 47 }, (_, index) => ({ eventId: `event-${index}`, stableRuleId: "missing", reviewedEvidence: { quote: "q", provenance: {} }, detail: { selectedCandidates: [] } })),
      audit: { results: [], totalRules: 0 } as any, draft: { rows: [] } as any, reloadedProposal: { rows: [] } as any,
      inputDocumentSha256: "doc", frozenRc2Baseline: { path: "base", sha256: "sha" }, frozenProposal: { path: "proposal", sha256: "sha" },
    })).toThrow("Missing selected candidate");
    const events = Array.from({ length: 47 }, (_, index) => ({ eventId: `event-${index}`, stableRuleId: "rule-1", reviewedEvidence: { quote: "target quote", provenance: {} }, detail: { selectedCandidates: [{ spanId: "target-span", quote: "target quote", page: 2, score: 1, evidenceType: "project_specific_implementation" as const, rejectionReason: null }] } }));
    const base = { diagnosticEvents: events, audit: { results: [result()], totalRules: 1 } as any, draft: { rows: [row()] } as any, reloadedProposal: { rows: [row()] } as any, inputDocumentSha256: "doc", frozenRc2Baseline: { path: "base", sha256: "sha" }, frozenProposal: { path: "proposal", sha256: "sha" } } as any;
    expect(() => buildVm0007Rc3SameRunHandoffTrace({ ...base, audit: { results: [], totalRules: 0 } })).toThrow("Missing audit rule alignment");
    expect(() => buildVm0007Rc3SameRunHandoffTrace({ ...base, draft: { rows: [] } })).toThrow("Missing draft rule alignment");
    expect(() => buildVm0007Rc3SameRunHandoffTrace({ ...base, reloadedProposal: { rows: [] } })).toThrow("Missing reloaded-proposal rule alignment");
  });

  it("computes independent survival facts and deterministic equivalent builds", () => {
    const events = Array.from({ length: 47 }, (_, index) => ({ eventId: `event-${index}`, stableRuleId: "rule-1", reviewedEvidence: { quote: "target quote", provenance: {} }, detail: { selectedCandidates: [{ spanId: "target-span", quote: "target quote", page: 2, score: 1, evidenceType: "project_specific_implementation" as const, rejectionReason: null }] } }));
    const make = () => buildVm0007Rc3SameRunHandoffTrace({ diagnosticEvents: events, audit: { results: [result()], totalRules: 1 } as any, draft: { rows: [row()] } as any, reloadedProposal: { rows: [row()] } as any, inputDocumentSha256: "doc", frozenRc2Baseline: { path: "base", sha256: "sha" }, frozenProposal: { path: "proposal", sha256: "sha" } });
    const first = make();
    const second = make();
    expect(first.stagePresenceTotals).toEqual({ selectedInFinalAuditEvidence: 47, selectedInBestMainAuditIdentity: 47, selectedInDraftAcceptedEvidence: 47, selectedAfterSerializationReload: 47, sameRunProposalSurvival: 47, bestEvidenceDivergence: 0, duplicateCardinalitySecondary: 0 });
    expect(serializeVm0007Rc3SameRunHandoffTrace(first)).toBe(serializeVm0007Rc3SameRunHandoffTrace(second));
    expect(Object.values(first.primaryStageCounts).reduce((sum, count) => sum + count, 0)).toBe(47);
    expect(first.events).toHaveLength(47);
    expect(new Set(first.events.map((event) => event.eventId)).size).toBe(47);
  });

  it("classifies the committed artifact exactly once and is deterministic", () => {
    const value = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    validateVm0007Rc3SameRunHandoffTrace(value);
    expect(value.parentEventCount).toBe(47);
    expect(Object.values(value.primaryStageCounts).reduce((sum: number, count) => sum + count, 0)).toBe(47);
    expect(serializeVm0007Rc3SameRunHandoffTrace(value)).toBe(serializeVm0007Rc3SameRunHandoffTrace(value));
    expect(value.auditExecutionSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(value.generatedProposalSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not alter production audit output when tracing is disabled", () => {
    const input = {
      rules: [{ id: "rule-1", title: "Rule", summary: "target quote", text: "target quote" }],
      evidenceDocument: { docId: "doc", spans: [{ spanId: "target-span", docId: "doc", text: "target quote", page: 1, sectionId: "S", sectionPath: ["S"], heading: "S", blockType: "paragraph", reliability: "primary" }] },
      getContract: () => ({ id: "contract", label: "target quote", methodologyId: "VM0007", rulebookVersion: "v1.8", pddSectionsToSearch: [], strongEvidenceSignals: ["target quote"], weakEvidenceSignals: [], rejectSignals: [], notApplicableSignals: [], defaultGapMessage: "gap", clientAction: "action", supportsNotApplicable: false }),
      versionContext: { methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8" },
    } as any;
    const plain = auditEvidence(input);
    const traced = auditEvidence({ ...input, diagnosticTrace: true });
    expect({ ...traced, diagnosticTrace: undefined }).toEqual(plain);
  });
});
