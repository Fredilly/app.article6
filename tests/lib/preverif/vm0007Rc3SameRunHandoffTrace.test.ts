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
    expect(classifySameRunHandoff({ selectedCandidate: identity, auditResult: audit, draftRow: draft, reloadedRow: reloaded }).primaryStage).toBe(expected);
  });

  it("keeps duplicate cardinality as a separate condition", () => {
    const classified = classifySameRunHandoff({ selectedCandidate: identity, auditResult: result(), draftRow: row(), reloadedRow: row(), duplicateCardinalityMismatch: true });
    expect(classified.primaryStage).toBe("duplicate_cardinality_complication");
    expect(classified.secondaryConditions).toEqual([]);
  });

  it("fails closed for missing, duplicate, and misaligned events", () => {
    const value = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    expect(() => validateVm0007Rc3SameRunHandoffTrace({ ...value, events: value.events.slice(0, -1), parentEventCount: 47 })).toThrow("event count");
    expect(() => validateVm0007Rc3SameRunHandoffTrace({ ...value, events: [...value.events.slice(0, -1), value.events[0]] })).toThrow("Duplicate");
    expect(() => buildVm0007Rc3SameRunHandoffTrace({
      diagnosticEvents: Array.from({ length: 47 }, (_, index) => ({ eventId: `event-${index}`, stableRuleId: "missing", reviewedEvidence: { quote: "q", provenance: {} }, detail: { selectedCandidates: [] } })),
      audit: { results: [], totalRules: 0 } as any, draft: { rows: [] } as any, reloadedProposal: { rows: [] } as any,
      inputDocumentSha256: "doc", frozenRc2Baseline: { path: "base", sha256: "sha" }, frozenProposal: { path: "proposal", sha256: "sha" },
    })).toThrow("Missing selected candidate");
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
